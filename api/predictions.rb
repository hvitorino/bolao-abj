require 'json'
require 'net/http'
require 'uri'
require 'time'

# Endpoint: POST /api/predictions — registra palpite
#           GET  /api/predictions?game_id=UUID — lê palpite do usuário para um jogo
#
# Autenticação: JWT Supabase via header Authorization: Bearer <token>
# Variáveis de ambiente:
#   NEXT_PUBLIC_SUPABASE_URL          — URL base do projeto
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — chave pública (publishable/anon)
#   SUPABASE_SERVICE_ROLE_KEY          — chave service_role (para operações admin)

SUPABASE_URL = ENV['NEXT_PUBLIC_SUPABASE_URL'] || ''
SUPABASE_ANON_KEY = ENV['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] || ''
SUPABASE_SERVICE_ROLE_KEY = ENV['SUPABASE_SERVICE_ROLE_KEY'] || ''

# Verifica JWT do Supabase e retorna dados do usuário ou nil
def authenticate(env)
  auth_header = env['HTTP_AUTHORIZATION']
  return nil unless auth_header && auth_header.start_with?('Bearer ')

  token = auth_header.sub('Bearer ', '').strip
  return nil if token.empty?

  begin
    uri = URI("#{SUPABASE_URL}/auth/v1/user")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')
    http.read_timeout = 5
    http.open_timeout = 5

    req = Net::HTTP::Get.new(uri.path)
    req['Authorization'] = "Bearer #{token}"
    req['apikey'] = SUPABASE_ANON_KEY

    res = http.request(req)
    return nil unless res.code == '200'

    JSON.parse(res.body)
  rescue StandardError
    nil
  end
end

# Executa query no Supabase via REST API com service_role (bypass RLS para leituras admin)
def supabase_request(method, path, body: nil, params: nil, use_service_role: false)
  url = "#{SUPABASE_URL}/rest/v1#{path}"
  url += "?#{params}" if params && !params.empty?

  uri = URI(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == 'https')
  http.read_timeout = 5
  http.open_timeout = 5

  key = use_service_role ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY

  req = case method
  when :get    then Net::HTTP::Get.new(uri)
  when :post   then Net::HTTP::Post.new(uri)
  when :delete then Net::HTTP::Delete.new(uri)
  end

  req['apikey'] = key
  req['Authorization'] = "Bearer #{key}"
  req['Content-Type'] = 'application/json'
  req['Prefer'] = 'return=representation'

  req.body = body.to_json if body

  http.request(req)
rescue StandardError => e
  nil
end

# Valida UUID v4
def valid_uuid?(str)
  return false unless str.is_a?(String)
  !!(str =~ /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
end

# Formata resposta JSON
def json_response(status, body)
  [status, { 'Content-Type' => 'application/json' }, [body.to_json]]
end

# Handler principal (Rack app)
run lambda { |env|
  begin
  # CORS headers para o frontend Next.js
  cors_headers = {
    'Access-Control-Allow-Origin' => '*',
    'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
    'Content-Type' => 'application/json'
  }

  # Preflight OPTIONS
  if env['REQUEST_METHOD'] == 'OPTIONS'
    next [200, cors_headers, []]
  end

  method = env['REQUEST_METHOD']

  # ── GET /api/predictions?game_id=UUID ──────────────────────────────────────
  if method == 'GET'
    # Autenticação
    user = authenticate(env)
    next json_response(401, { error: 'unauthorized', message: 'Autenticação requerida.' }) unless user

    # Validação do game_id
    query_string = env['QUERY_STRING'] || ''
    params = URI.decode_www_form(query_string).to_h
    game_id = params['game_id']

    unless valid_uuid?(game_id)
      next json_response(400, { error: 'invalid_params', message: 'game_id é obrigatório e deve ser um UUID válido.' })
    end

    user_id = user['id']

    # Buscar palpite via Supabase REST
    res = supabase_request(
      :get,
      '/predictions',
      params: "user_id=eq.#{user_id}&game_id=eq.#{game_id}&select=id,game_id,user_id,home_score,away_score,submitted_at",
      use_service_role: false
    )

    if res.nil? || res.code.to_i >= 500
      next json_response(500, { error: 'server_error', message: 'Erro ao buscar palpite.' })
    end

    predictions = JSON.parse(res.body) rescue []
    prediction = predictions.first

    next json_response(200, prediction) # nil retorna null em JSON

  # ── POST /api/predictions ───────────────────────────────────────────────────
  elsif method == 'POST'
    # Autenticação
    user = authenticate(env)
    next json_response(401, { error: 'unauthorized', message: 'Autenticação requerida.' }) unless user

    # Leitura do body
    request_body = env['rack.input'].read
    body = JSON.parse(request_body) rescue {}

    game_id    = body['game_id']
    home_score = body['home_score']
    away_score = body['away_score']

    # Validação de game_id
    unless valid_uuid?(game_id)
      next json_response(422, { error: 'invalid_params', message: 'game_id é obrigatório e deve ser um UUID válido.' })
    end

    # Validação de home_score e away_score
    unless home_score.is_a?(Integer) && away_score.is_a?(Integer) &&
           home_score >= 0 && away_score >= 0
      next json_response(422, { error: 'invalid_params', message: 'home_score e away_score são obrigatórios e devem ser inteiros >= 0.' })
    end

    # Buscar jogo para validar existência e deadline
    res = supabase_request(
      :get,
      '/games',
      params: "id=eq.#{game_id}&select=id,match_date,status",
      use_service_role: true
    )

    if res.nil? || !res.code.to_i.between?(200, 299)
      next json_response(500, { error: 'server_error', message: 'Erro ao verificar jogo.' })
    end

    games = JSON.parse(res.body) rescue nil
    game = games.is_a?(Array) ? games.first : nil

    next json_response(404, { error: 'not_found', message: 'Jogo não encontrado.' }) unless game

    # Validação do deadline: 5 minutos antes do início
    raw_date = game['match_date']
    next json_response(500, { error: 'server_error', message: 'Jogo sem data.' }) if raw_date.nil?
    match_date = Time.parse(raw_date).utc
    deadline   = match_date - (5 * 60) # 5 minutos em segundos
    now        = Time.now.utc

    if now >= deadline
      next json_response(422, {
        error: 'deadline_expired',
        message: 'Prazo encerrado. Não é possível registrar palpite após 5 minutos antes do início.'
      })
    end

    user_id = user['id']

    # Verificar se já existe palpite para esse (user_id, game_id)
    res = supabase_request(
      :get,
      '/predictions',
      params: "user_id=eq.#{user_id}&game_id=eq.#{game_id}&select=id",
      use_service_role: true
    )

    existing_parsed = res.nil? ? nil : (JSON.parse(res.body) rescue nil)
    existing = existing_parsed.is_a?(Array) ? existing_parsed : []
    if existing.length > 0
      next json_response(422, {
        error: 'already_submitted',
        message: 'Você já enviou um palpite para este jogo.'
      })
    end

    # Inserir palpite
    res = supabase_request(
      :post,
      '/predictions',
      body: {
        user_id:      user_id,
        game_id:      game_id,
        home_score:   home_score,
        away_score:   away_score,
        submitted_at: now.iso8601
      },
      use_service_role: true
    )

    if res.nil? || res.code.to_i >= 500
      next json_response(500, { error: 'server_error', message: 'Erro ao registrar palpite.' })
    end

    if res.code.to_i == 409
      next json_response(422, {
        error: 'already_submitted',
        message: 'Você já enviou um palpite para este jogo.'
      })
    end

    if res.code.to_i >= 400
      next json_response(422, { error: 'invalid_params', message: 'Erro ao registrar palpite. Verifique os dados.' })
    end

    inserted = (JSON.parse(res.body) rescue [])
    prediction = inserted.is_a?(Array) ? inserted.first : inserted

    next json_response(201, prediction)

  else
    json_response(405, { error: 'method_not_allowed', message: 'Método não permitido.' })
  end
  rescue => e
    $stderr.puts "PREDICTIONS UNHANDLED: #{e.class}: #{e.message}\n#{e.backtrace.first(8).join("\n")}"
    [500, { 'Content-Type' => 'application/json' }, [{ error: 'critical', klass: e.class.to_s, message: e.message, trace: e.backtrace.first(5) }.to_json]]
  end
}
