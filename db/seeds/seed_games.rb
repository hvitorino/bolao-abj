#!/usr/bin/env ruby
# frozen_string_literal: true

# Seed script: dataset placeholder para navegação de jogos da Copa 2026
# Uso:
#   SUPABASE_URL=https://xxx.supabase.co \
#   SUPABASE_SERVICE_ROLE_KEY=xxx \
#   ruby db/seeds/seed_games.rb

require 'net/http'
require 'json'
require 'uri'

SUPABASE_URL = ENV.fetch('SUPABASE_URL') { abort 'SUPABASE_URL não definida' }
SUPABASE_KEY = ENV.fetch('SUPABASE_SERVICE_ROLE_KEY') { abort 'SUPABASE_SERVICE_ROLE_KEY não definida' }

# ATENÇÃO:
# Este arquivo NÃO representa o calendário oficial/real da Copa do Mundo FIFA 2026.
# Como não há uma fonte oficial verificável registrada neste repositório para os
# confrontos da competição, o seed abaixo usa um dataset fictício/placeholder,
# internamente coerente, voltado apenas para desenvolvimento e testes da UI.
# Troque os jogos apenas quando houver uma fonte oficial confiável e auditável.
GAMES = [
  # Dia 1 — 11 de junho de 2026
  {
    home_team: 'México',
    away_team: 'Japão',
    home_team_code: 'MEX',
    away_team_code: 'JPN',
    match_date: '2026-06-11T20:00:00Z',
    status: 'pending',
    round: 'Grupo A',
    venue: 'Estadio Azteca, Cidade do México'
  },
  {
    home_team: 'Portugal',
    away_team: 'Camarões',
    home_team_code: 'POR',
    away_team_code: 'CMR',
    match_date: '2026-06-12T00:00:00Z',
    status: 'pending',
    round: 'Grupo A',
    venue: 'Estadio BBVA, Monterrey'
  },

  # Dia 2 — 12 de junho de 2026
  {
    home_team: 'Canadá',
    away_team: 'Nigéria',
    home_team_code: 'CAN',
    away_team_code: 'NGA',
    match_date: '2026-06-12T20:00:00Z',
    status: 'pending',
    round: 'Grupo B',
    venue: 'BC Place, Vancouver'
  },
  {
    home_team: 'Inglaterra',
    away_team: 'Croácia',
    home_team_code: 'ENG',
    away_team_code: 'CRO',
    match_date: '2026-06-13T01:00:00Z',
    status: 'pending',
    round: 'Grupo B',
    venue: 'Gillette Stadium, Boston'
  },

  # Dia 3 — 13 de junho de 2026
  {
    home_team: 'EUA',
    away_team: 'Coreia do Sul',
    home_team_code: 'USA',
    away_team_code: 'KOR',
    match_date: '2026-06-13T17:00:00Z',
    status: 'pending',
    round: 'Grupo C',
    venue: 'SoFi Stadium, Los Angeles'
  },
  {
    home_team: 'Holanda',
    away_team: 'Senegal',
    home_team_code: 'NED',
    away_team_code: 'SEN',
    match_date: '2026-06-13T20:00:00Z',
    status: 'pending',
    round: 'Grupo C',
    venue: 'NRG Stadium, Houston'
  },
  {
    home_team: 'Argentina',
    away_team: 'Equador',
    home_team_code: 'ARG',
    away_team_code: 'ECU',
    match_date: '2026-06-14T00:00:00Z',
    status: 'pending',
    round: 'Grupo D',
    venue: 'MetLife Stadium, Nova Jersey'
  },

  # Dia 4 — 14 de junho de 2026
  {
    home_team: 'Itália',
    away_team: 'Gana',
    home_team_code: 'ITA',
    away_team_code: 'GHA',
    match_date: '2026-06-14T17:00:00Z',
    status: 'pending',
    round: 'Grupo D',
    venue: 'Lincoln Financial Field, Filadélfia'
  },
  {
    home_team: 'Espanha',
    away_team: 'Marrocos',
    home_team_code: 'ESP',
    away_team_code: 'MAR',
    match_date: '2026-06-14T20:00:00Z',
    status: 'pending',
    round: 'Grupo E',
    venue: 'AT&T Stadium, Dallas'
  },
  {
    home_team: 'Alemanha',
    away_team: 'Dinamarca',
    home_team_code: 'GER',
    away_team_code: 'DEN',
    match_date: '2026-06-15T00:00:00Z',
    status: 'pending',
    round: 'Grupo E',
    venue: 'Arrowhead Stadium, Kansas City'
  },

  # Dia 5 — 15 de junho de 2026
  {
    home_team: 'França',
    away_team: 'Colômbia',
    home_team_code: 'FRA',
    away_team_code: 'COL',
    match_date: '2026-06-15T17:00:00Z',
    status: 'pending',
    round: 'Grupo F',
    venue: 'Levi\'s Stadium, San Francisco'
  },
  {
    home_team: 'Brasil',
    away_team: 'Sérvia',
    home_team_code: 'BRA',
    away_team_code: 'SRB',
    match_date: '2026-06-15T20:00:00Z',
    status: 'pending',
    round: 'Grupo F',
    venue: 'Rose Bowl, Los Angeles'
  },
  {
    home_team: 'México',
    away_team: 'Camarões',
    home_team_code: 'MEX',
    away_team_code: 'CMR',
    match_date: '2026-06-16T00:00:00Z',
    status: 'pending',
    round: 'Grupo A',
    venue: 'Estadio Azteca, Cidade do México'
  },

  # Dia 6 — 16 de junho de 2026
  {
    home_team: 'Canadá',
    away_team: 'Croácia',
    home_team_code: 'CAN',
    away_team_code: 'CRO',
    match_date: '2026-06-16T17:00:00Z',
    status: 'pending',
    round: 'Grupo B',
    venue: 'BMO Field, Toronto'
  },
  {
    home_team: 'EUA',
    away_team: 'Senegal',
    home_team_code: 'USA',
    away_team_code: 'SEN',
    match_date: '2026-06-16T20:00:00Z',
    status: 'pending',
    round: 'Grupo C',
    venue: 'Hard Rock Stadium, Miami'
  }
].freeze

def build_request(path, headers = {})
  uri = URI("#{SUPABASE_URL}#{path}")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = uri.scheme == 'https'
  request = yield(uri)
  request['apikey'] = SUPABASE_KEY
  request['Authorization'] = "Bearer #{SUPABASE_KEY}"
  headers.each { |key, value| request[key] = value }

  [http, request]
end

def game_exists?(game)
  query = URI.encode_www_form(
    select: 'id',
    home_team_code: "eq.#{game[:home_team_code]}",
    away_team_code: "eq.#{game[:away_team_code]}",
    match_date: "eq.#{game[:match_date]}"
  )

  http, request = build_request("/rest/v1/games?#{query}") do |uri|
    Net::HTTP::Get.new(uri)
  end

  response = http.request(request)

  unless response.code.to_i.between?(200, 299)
    puts "  ERRO [#{response.code}]: falha ao verificar duplicata para #{game[:home_team]} × #{game[:away_team]}"
    puts "        #{response.body}"
    # Falha fechada: não inferimos ausência de duplicata em caso de erro na verificação
    return :error
  end

  JSON.parse(response.body).any?
end

def insert_game(game)
  # Inclui on_conflict no path para que o PostgREST use upsert "ignore-duplicates":
  # se a UNIQUE constraint (home_team_code, away_team_code, match_date) disparar,
  # o insert é silenciosamente ignorado — segunda linha de defesa após game_exists?
  on_conflict_param = URI.encode_www_form(on_conflict: 'home_team_code,away_team_code,match_date')
  http, request = build_request(
    "/rest/v1/games?#{on_conflict_param}",
    'Content-Type' => 'application/json',
    'Prefer' => 'return=minimal,resolution=ignore-duplicates'
  ) do |uri|
    Net::HTTP::Post.new(uri)
  end

  request.body = game.to_json

  response = http.request(request)

  if response.code.to_i.between?(200, 299)
    puts "  OK: #{game[:home_team]} × #{game[:away_team]} (#{game[:round]}) — #{game[:match_date]}"
  else
    puts "  ERRO [#{response.code}]: #{game[:home_team]} × #{game[:away_team]}"
    puts "        #{response.body}"
  end
end

if __FILE__ == $PROGRAM_NAME
  puts '=== Seed: dataset placeholder de jogos da Copa 2026 ==='
  puts 'ATENÇÃO: confrontos fictícios para desenvolvimento; não usar como calendário oficial.'
  puts "Processando #{GAMES.length} jogos...\n\n"

  GAMES.each_with_index do |game, index|
    print "#{(index + 1).to_s.rjust(2)}. "

    exists = game_exists?(game)

    if exists == :error
      puts "  SKIP (erro na verificação): #{game[:home_team]} × #{game[:away_team]} — insert abortado para evitar duplicata silenciosa"
      next
    end

    if exists
      puts "  SKIP: #{game[:home_team]} × #{game[:away_team]} já existe"
      next
    end

    insert_game(game)
  end

  puts "\nConcluído."
end
