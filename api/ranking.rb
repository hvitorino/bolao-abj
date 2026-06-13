require 'json'
require 'net/http'
require 'uri'

# Endpoint: GET /api/ranking — retorna ranking geral do bolão
#
# Autenticação: JWT Supabase via header Authorization: Bearer <token>
# Retorna todos os participantes ordenados por pontos totais (desc),
# com aproveitamento calculado no servidor.
#
# Variáveis de ambiente:
#   SUPABASE_URL              — URL base do projeto (ex: https://xyzxyz.supabase.co)
#   SUPABASE_ANON_KEY         — chave anon pública (para autenticar o usuário)
#   SUPABASE_SERVICE_ROLE_KEY — chave service_role (para contornar RLS em scores)

SUPABASE_URL_RANKING = ENV['SUPABASE_URL'] || ''
SUPABASE_ANON_KEY_RANKING = ENV['SUPABASE_ANON_KEY'] || ''
SUPABASE_SERVICE_KEY_RANKING = ENV['SUPABASE_SERVICE_ROLE_KEY'] || ''

# Máximo de pontos possíveis por jogo
# Regras: vencedor(3) + exato(5) + goleada(1) = 9 pts máximos por jogo
MAX_POINTS_PER_GAME = 9

# Verifica JWT do Supabase e retorna dados do usuário ou nil
def authenticate_ranking(env)
  auth_header = env['HTTP_AUTHORIZATION']
  return nil unless auth_header && auth_header.start_with?('Bearer ')

  token = auth_header.sub('Bearer ', '').strip
  return nil if token.empty?

  begin
    uri = URI("#{SUPABASE_URL_RANKING}/auth/v1/user")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')
    http.read_timeout = 5
    http.open_timeout = 5

    req = Net::HTTP::Get.new(uri)
    req['Authorization'] = "Bearer #{token}"
    req['apikey'] = SUPABASE_ANON_KEY_RANKING

    res = http.request(req)
    return nil unless res.code == '200'

    JSON.parse(res.body)
  rescue StandardError
    nil
  end
end

# Chama função RPC do Supabase com service_role (contorna RLS)
def supabase_rpc_ranking(function_name, params = {})
  url = "#{SUPABASE_URL_RANKING}/rest/v1/rpc/#{function_name}"
  uri = URI(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == 'https')
  http.read_timeout = 10
  http.open_timeout = 5

  req = Net::HTTP::Post.new(uri)
  req['apikey'] = SUPABASE_SERVICE_KEY_RANKING
  req['Authorization'] = "Bearer #{SUPABASE_SERVICE_KEY_RANKING}"
  req['Content-Type'] = 'application/json'
  req['Prefer'] = 'return=representation'
  req.body = params.to_json

  http.request(req)
rescue StandardError
  nil
end

# Formata resposta JSON
def json_resp_ranking(status, body)
  [status, { 'Content-Type' => 'application/json' }, [body.to_json]]
end

# Calcula aproveitamento percentual
# aproveitamento = total_points / (games_predicted * MAX_POINTS_PER_GAME) * 100
def calc_aproveitamento(total_points, games_predicted)
  return 0 if games_predicted.nil? || games_predicted == 0
  max_possible = games_predicted * MAX_POINTS_PER_GAME
  ((total_points.to_f / max_possible) * 100).round(0).to_i
end

# Handler principal (Rack app)
run lambda { |env|
  cors_headers = {
    'Access-Control-Allow-Origin' => '*',
    'Access-Control-Allow-Methods' => 'GET, OPTIONS',
    'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
    'Content-Type' => 'application/json'
  }

  # Preflight OPTIONS
  if env['REQUEST_METHOD'] == 'OPTIONS'
    next [200, cors_headers, []]
  end

  # Apenas GET é aceito
  unless env['REQUEST_METHOD'] == 'GET'
    next json_resp_ranking(405, { error: 'Método não permitido.' })
  end

  # ── Autenticação via JWT Supabase ─────────────────────────────────────────────
  user = authenticate_ranking(env)
  next json_resp_ranking(401, { error: 'Autenticação requerida.' }) unless user

  # ── Buscar ranking via função RPC get_ranking() ───────────────────────────────
  # A função get_ranking() tem SECURITY DEFINER e contorna o RLS de scores,
  # retornando todos os participantes com pontuação.
  res = supabase_rpc_ranking('get_ranking')

  if res.nil? || res.code.to_i >= 500
    next json_resp_ranking(500, { error: 'Erro ao buscar ranking.' })
  end

  if res.code.to_i >= 400
    error_body = JSON.parse(res.body) rescue { 'message' => 'Erro desconhecido' }
    next json_resp_ranking(502, { error: "Erro ao executar ranking: #{error_body['message']}" })
  end

  entries = JSON.parse(res.body) rescue []

  # Adicionar aproveitamento calculado no servidor
  ranking = entries.map do |entry|
    {
      position: entry['position'],
      user_id: entry['user_id'],
      participant_name: entry['participant_name'],
      total_points: entry['total_points'].to_i,
      games_predicted: entry['games_predicted'].to_i,
      aproveitamento: calc_aproveitamento(entry['total_points'].to_i, entry['games_predicted'].to_i)
    }
  end

  json_resp_ranking(200, ranking)
}
