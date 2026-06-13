require 'json'
require 'net/http'
require 'uri'
require 'time'

# Endpoint: PATCH /api/admin/games/:id — atualiza placar e/ou status de um jogo
#
# Autenticação: header X-Admin-Secret com valor da variável de ambiente ADMIN_SECRET
# Não usa JWT de usuário — é exclusivo para operação administrativa.
#
# O UPDATE no banco dispara automaticamente o Supabase Realtime via WAL replication,
# propagando a atualização para todos os GameCards subscritos em < 2s.
#
# Variáveis de ambiente:
#   SUPABASE_URL              — URL base do projeto (ex: https://xyzxyz.supabase.co)
#   SUPABASE_SERVICE_ROLE_KEY — chave service_role (bypass RLS)
#   ADMIN_SECRET              — segredo compartilhado para autenticação admin

SUPABASE_URL_ADMIN = ENV['SUPABASE_URL'] || ''
SUPABASE_SERVICE_KEY = ENV['SUPABASE_SERVICE_ROLE_KEY'] || ''
ADMIN_SECRET = ENV['ADMIN_SECRET'] || ''

VALID_STATUSES = %w[pending live finished].freeze

# Valida UUID v4
def valid_uuid_admin?(str)
  return false unless str.is_a?(String)
  !!(str =~ /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
end

# Executa requisição PATCH no Supabase via REST API com service_role
def supabase_patch(path, body, params: nil)
  url = "#{SUPABASE_URL_ADMIN}/rest/v1#{path}"
  url += "?#{params}" if params && !params.empty?

  uri = URI(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == 'https')
  http.read_timeout = 5
  http.open_timeout = 5

  req = Net::HTTP::Patch.new(uri)
  req['apikey'] = SUPABASE_SERVICE_KEY
  req['Authorization'] = "Bearer #{SUPABASE_SERVICE_KEY}"
  req['Content-Type'] = 'application/json'
  req['Prefer'] = 'return=representation'
  req.body = body.to_json

  http.request(req)
rescue StandardError
  nil
end

# Executa requisição GET no Supabase via REST API com service_role
def supabase_get_admin(path, params: nil)
  url = "#{SUPABASE_URL_ADMIN}/rest/v1#{path}"
  url += "?#{params}" if params && !params.empty?

  uri = URI(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == 'https')
  http.read_timeout = 5
  http.open_timeout = 5

  req = Net::HTTP::Get.new(uri)
  req['apikey'] = SUPABASE_SERVICE_KEY
  req['Authorization'] = "Bearer #{SUPABASE_SERVICE_KEY}"
  req['Content-Type'] = 'application/json'

  http.request(req)
rescue StandardError
  nil
end

# Formata resposta JSON
def json_resp(status, body)
  [status, { 'Content-Type' => 'application/json' }, [body.to_json]]
end

# Handler principal (Rack app)
run lambda { |env|
  cors_headers = {
    'Access-Control-Allow-Origin' => '*',
    'Access-Control-Allow-Methods' => 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers' => 'Content-Type, X-Admin-Secret',
    'Content-Type' => 'application/json'
  }

  # Preflight OPTIONS
  if env['REQUEST_METHOD'] == 'OPTIONS'
    next [200, cors_headers, []]
  end

  # Apenas PATCH é aceito
  unless env['REQUEST_METHOD'] == 'PATCH'
    next json_resp(405, { error: 'Método não permitido.' })
  end

  # ── Autenticação via ADMIN_SECRET ────────────────────────────────────────────
  provided_secret = env['HTTP_X_ADMIN_SECRET']
  if ADMIN_SECRET.empty? || provided_secret.nil? || provided_secret != ADMIN_SECRET
    next json_resp(401, { error: 'Não autorizado.' })
  end

  # ── Extrair e validar ID da URL ──────────────────────────────────────────────
  # O Vercel injeta o path completo; extraímos o segmento final como :id
  path_info = env['PATH_INFO'] || ''
  game_id = path_info.split('/').last

  unless valid_uuid_admin?(game_id)
    next json_resp(400, { error: 'ID de jogo inválido.' })
  end

  # ── Ler e validar body JSON ──────────────────────────────────────────────────
  request_body = env['rack.input'].read
  body = JSON.parse(request_body) rescue {}

  updates = {}

  # Validar home_score (opcional)
  if body.key?('home_score')
    home_score = body['home_score']
    unless home_score.is_a?(Integer) && home_score >= 0
      next json_resp(422, { error: 'home_score deve ser inteiro não negativo.' })
    end
    updates[:home_score] = home_score
  end

  # Validar away_score (opcional)
  if body.key?('away_score')
    away_score = body['away_score']
    unless away_score.is_a?(Integer) && away_score >= 0
      next json_resp(422, { error: 'away_score deve ser inteiro não negativo.' })
    end
    updates[:away_score] = away_score
  end

  # Validar status (opcional)
  if body.key?('status')
    status = body['status']
    unless VALID_STATUSES.include?(status)
      next json_resp(422, { error: "status inválido. Valores aceitos: #{VALID_STATUSES.join(', ')}." })
    end
    updates[:status] = status
  end

  # Pelo menos um campo deve estar presente
  if updates.empty?
    next json_resp(422, { error: 'Nenhum campo válido para atualizar. Forneça home_score, away_score e/ou status.' })
  end

  # ── Verificar existência do jogo ─────────────────────────────────────────────
  res = supabase_get_admin('/games', params: "id=eq.#{game_id}&select=id")

  if res.nil? || res.code.to_i >= 500
    next json_resp(500, { error: 'Erro ao verificar jogo no banco.' })
  end

  games = JSON.parse(res.body) rescue []
  if games.empty?
    next json_resp(404, { error: 'Jogo não encontrado.' })
  end

  # ── Executar UPDATE no banco ─────────────────────────────────────────────────
  # O UPDATE dispara o Supabase Realtime via WAL replication automaticamente.
  # Todos os GameCards subscritos ao canal "game-<game_id>" recebem o evento UPDATE.
  res = supabase_patch(
    '/games',
    updates,
    params: "id=eq.#{game_id}"
  )

  if res.nil? || res.code.to_i >= 500
    next json_resp(500, { error: 'Erro ao atualizar jogo.' })
  end

  if res.code.to_i >= 400
    next json_resp(422, { error: 'Erro ao atualizar jogo. Verifique os dados.' })
  end

  updated = JSON.parse(res.body) rescue []
  game = updated.is_a?(Array) ? updated.first : updated

  json_resp(200, game)
}
