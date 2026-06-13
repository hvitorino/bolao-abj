require 'json'
require 'net/http'
require 'uri'

# Endpoint: POST /api/scores/calculate — recalcula pontuação de todos os palpites de um jogo
#
# Autenticação: header X-Admin-Secret com valor da variável de ambiente ADMIN_SECRET
# Uso principal: recálculo manual quando o placar é corrigido após o jogo já encerrado.
# O trigger Postgres `on_game_finished` é o mecanismo primário de cálculo automático.
#
# Variáveis de ambiente:
#   SUPABASE_URL              — URL base do projeto (ex: https://xyzxyz.supabase.co)
#   SUPABASE_SERVICE_ROLE_KEY — chave service_role (bypass RLS)
#   ADMIN_SECRET              — segredo compartilhado para autenticação admin

SUPABASE_URL_SCORES = ENV['SUPABASE_URL'] || ''
SUPABASE_SERVICE_KEY_SCORES = ENV['SUPABASE_SERVICE_ROLE_KEY'] || ''
ADMIN_SECRET_SCORES = ENV['ADMIN_SECRET'] || ''

# Valida UUID v4
def valid_uuid_scores?(str)
  return false unless str.is_a?(String)
  !!(str =~ /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
end

# Executa RPC no Supabase (chama função Postgres)
def supabase_rpc(function_name, params)
  url = "#{SUPABASE_URL_SCORES}/rest/v1/rpc/#{function_name}"
  uri = URI(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == 'https')
  http.read_timeout = 15
  http.open_timeout = 5

  req = Net::HTTP::Post.new(uri)
  req['apikey'] = SUPABASE_SERVICE_KEY_SCORES
  req['Authorization'] = "Bearer #{SUPABASE_SERVICE_KEY_SCORES}"
  req['Content-Type'] = 'application/json'
  req.body = params.to_json

  http.request(req)
rescue StandardError
  nil
end

# Executa requisição GET no Supabase via REST API com service_role
def supabase_get_scores(path, params: nil)
  url = "#{SUPABASE_URL_SCORES}/rest/v1#{path}"
  url += "?#{params}" if params && !params.empty?

  uri = URI(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == 'https')
  http.read_timeout = 5
  http.open_timeout = 5

  req = Net::HTTP::Get.new(uri)
  req['apikey'] = SUPABASE_SERVICE_KEY_SCORES
  req['Authorization'] = "Bearer #{SUPABASE_SERVICE_KEY_SCORES}"
  req['Content-Type'] = 'application/json'

  http.request(req)
rescue StandardError
  nil
end

# Formata resposta JSON
def json_resp_scores(status, body)
  [status, { 'Content-Type' => 'application/json' }, [body.to_json]]
end

# Handler principal (Rack app)
run lambda { |env|
  cors_headers = {
    'Access-Control-Allow-Origin' => '*',
    'Access-Control-Allow-Methods' => 'POST, OPTIONS',
    'Access-Control-Allow-Headers' => 'Content-Type, X-Admin-Secret',
    'Content-Type' => 'application/json'
  }

  # Preflight OPTIONS
  if env['REQUEST_METHOD'] == 'OPTIONS'
    next [200, cors_headers, []]
  end

  # Apenas POST é aceito
  unless env['REQUEST_METHOD'] == 'POST'
    next json_resp_scores(405, { error: 'Método não permitido.' })
  end

  # ── Autenticação via ADMIN_SECRET ────────────────────────────────────────────
  provided_secret = env['HTTP_X_ADMIN_SECRET']
  if ADMIN_SECRET_SCORES.empty? || provided_secret.nil? || provided_secret != ADMIN_SECRET_SCORES
    next json_resp_scores(401, { error: 'Não autorizado.' })
  end

  # ── Ler e validar body JSON ──────────────────────────────────────────────────
  request_body = env['rack.input'].read
  body = JSON.parse(request_body) rescue {}

  game_id = body['game_id']

  unless valid_uuid_scores?(game_id)
    next json_resp_scores(400, { error: 'game_id é obrigatório e deve ser um UUID válido.' })
  end

  # ── Verificar existência e status do jogo ────────────────────────────────────
  res = supabase_get_scores('/games', params: "id=eq.#{game_id}&select=id,status,home_score,away_score")

  if res.nil? || res.code.to_i >= 500
    next json_resp_scores(500, { error: 'Erro ao verificar jogo no banco.' })
  end

  games = JSON.parse(res.body) rescue []
  if games.empty?
    next json_resp_scores(404, { error: 'Jogo não encontrado.' })
  end

  game = games.first

  # Jogo deve estar encerrado com placar para calcular pontuação
  unless game['status'] == 'finished'
    next json_resp_scores(422, { error: 'Jogo ainda não encerrado. status deve ser "finished".' })
  end

  if game['home_score'].nil? || game['away_score'].nil?
    next json_resp_scores(422, { error: 'Jogo encerrado sem placar definido. Defina home_score e away_score antes de calcular.' })
  end

  # ── Chamar função Postgres via RPC ───────────────────────────────────────────
  # A função `calculate_scores_for_game` faz UPSERT em scores para todos os palpites do jogo
  res = supabase_rpc('calculate_scores_for_game', { p_game_id: game_id })

  if res.nil? || res.code.to_i >= 500
    next json_resp_scores(500, { error: 'Erro ao calcular pontuações.' })
  end

  if res.code.to_i >= 400
    error_body = JSON.parse(res.body) rescue { 'message' => 'Erro desconhecido' }
    next json_resp_scores(422, { error: "Erro ao calcular pontuações: #{error_body['message']}" })
  end

  json_resp_scores(200, { message: 'Pontuações calculadas com sucesso.', game_id: game_id })
}
