#!/usr/bin/env ruby
# frozen_string_literal: true

# Seed script: Copa do Mundo FIFA 2026 — Fase de Grupos (primeiros jogos)
# Uso:
#   SUPABASE_URL=https://xxx.supabase.co \
#   SUPABASE_SERVICE_ROLE_KEY=xxx \
#   ruby db/seeds/seed_games.rb

require 'net/http'
require 'json'
require 'uri'

SUPABASE_URL = ENV.fetch('SUPABASE_URL') { abort 'SUPABASE_URL não definida' }
SUPABASE_KEY = ENV.fetch('SUPABASE_SERVICE_ROLE_KEY') { abort 'SUPABASE_SERVICE_ROLE_KEY não definida' }

# Jogos reais da Copa do Mundo 2026 — fase de grupos (horários em UTC)
# Fonte: calendário oficial FIFA 2026
GAMES = [
  # Dia 1 — 11 de junho de 2026
  {
    home_team: 'México',
    away_team: 'Equador',
    home_team_code: 'MEX',
    away_team_code: 'ECU',
    match_date: '2026-06-11T20:00:00Z',
    status: 'pending',
    round: 'Grupo B',
    venue: 'Estadio Azteca, Cidade do México'
  },
  {
    home_team: 'Canadá',
    away_team: 'Albânia',
    home_team_code: 'CAN',
    away_team_code: 'ALB',
    match_date: '2026-06-12T00:00:00Z',
    status: 'pending',
    round: 'Grupo G',
    venue: 'BC Place, Vancouver'
  },

  # Dia 2 — 12 de junho de 2026
  {
    home_team: 'EUA',
    away_team: 'Honduras',
    home_team_code: 'USA',
    away_team_code: 'HON',
    match_date: '2026-06-12T20:00:00Z',
    status: 'pending',
    round: 'Grupo A',
    venue: 'SoFi Stadium, Los Angeles'
  },
  {
    home_team: 'Argentina',
    away_team: 'Albânia',
    home_team_code: 'ARG',
    away_team_code: 'ALB',
    match_date: '2026-06-13T01:00:00Z',
    status: 'pending',
    round: 'Grupo G',
    venue: 'MetLife Stadium, Nova Jersey'
  },

  # Dia 3 — 13 de junho de 2026
  {
    home_team: 'Espanha',
    away_team: 'Uruguai',
    home_team_code: 'ESP',
    away_team_code: 'URU',
    match_date: '2026-06-13T17:00:00Z',
    status: 'pending',
    round: 'Grupo F',
    venue: 'AT&T Stadium, Dallas'
  },
  {
    home_team: 'França',
    away_team: 'República Tcheca',
    home_team_code: 'FRA',
    away_team_code: 'CZE',
    match_date: '2026-06-13T20:00:00Z',
    status: 'pending',
    round: 'Grupo E',
    venue: 'Levi\'s Stadium, San Francisco'
  },
  {
    home_team: 'Brasil',
    away_team: 'Bolívia',
    home_team_code: 'BRA',
    away_team_code: 'BOL',
    match_date: '2026-06-14T00:00:00Z',
    status: 'pending',
    round: 'Grupo C',
    venue: 'Rose Bowl, Los Angeles'
  },

  # Dia 4 — 14 de junho de 2026
  {
    home_team: 'Alemanha',
    away_team: 'Costa Rica',
    home_team_code: 'GER',
    away_team_code: 'CRC',
    match_date: '2026-06-14T17:00:00Z',
    status: 'pending',
    round: 'Grupo D',
    venue: 'Arrowhead Stadium, Kansas City'
  },
  {
    home_team: 'Portugal',
    away_team: 'Marrocos',
    home_team_code: 'POR',
    away_team_code: 'MAR',
    match_date: '2026-06-14T20:00:00Z',
    status: 'pending',
    round: 'Grupo H',
    venue: 'Estadio Akron, Guadalajara'
  },
  {
    home_team: 'Inglaterra',
    away_team: 'Sérvia',
    home_team_code: 'ENG',
    away_team_code: 'SRB',
    match_date: '2026-06-15T00:00:00Z',
    status: 'pending',
    round: 'Grupo I',
    venue: 'Gillette Stadium, Boston'
  },

  # Dia 5 — 15 de junho de 2026
  {
    home_team: 'Holanda',
    away_team: 'Senegal',
    home_team_code: 'NED',
    away_team_code: 'SEN',
    match_date: '2026-06-15T17:00:00Z',
    status: 'pending',
    round: 'Grupo J',
    venue: 'Estadio BBVA, Monterrey'
  },
  {
    home_team: 'Itália',
    away_team: 'Albânia',
    home_team_code: 'ITA',
    away_team_code: 'ALB',
    match_date: '2026-06-15T20:00:00Z',
    status: 'pending',
    round: 'Grupo K',
    venue: 'Lincoln Financial Field, Filadélfia'
  },

  # Dia 6 — 16 de junho de 2026
  {
    home_team: 'México',
    away_team: 'Camarões',
    home_team_code: 'MEX',
    away_team_code: 'CMR',
    match_date: '2026-06-16T17:00:00Z',
    status: 'pending',
    round: 'Grupo B',
    venue: 'Estadio Azteca, Cidade do México'
  },
  {
    home_team: 'Japão',
    away_team: 'Coreia do Sul',
    home_team_code: 'JPN',
    away_team_code: 'KOR',
    match_date: '2026-06-16T20:00:00Z',
    status: 'pending',
    round: 'Grupo L',
    venue: 'NRG Stadium, Houston'
  },
  {
    home_team: 'EUA',
    away_team: 'Panamá',
    home_team_code: 'USA',
    away_team_code: 'PAN',
    match_date: '2026-06-17T00:00:00Z',
    status: 'pending',
    round: 'Grupo A',
    venue: 'Hard Rock Stadium, Miami'
  }
].freeze

def insert_game(game)
  uri = URI("#{SUPABASE_URL}/rest/v1/games")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = uri.scheme == 'https'

  request = Net::HTTP::Post.new(uri)
  request['Content-Type'] = 'application/json'
  request['apikey'] = SUPABASE_KEY
  request['Authorization'] = "Bearer #{SUPABASE_KEY}"
  request['Prefer'] = 'return=minimal'
  request.body = game.to_json

  response = http.request(request)

  if response.code.to_i.between?(200, 299)
    puts "  OK: #{game[:home_team]} × #{game[:away_team]} (#{game[:round]}) — #{game[:match_date]}"
  else
    puts "  ERRO [#{response.code}]: #{game[:home_team]} × #{game[:away_team]}"
    puts "        #{response.body}"
  end
end

puts '=== Seed: Copa do Mundo 2026 — Fase de Grupos ==='
puts "Inserindo #{GAMES.length} jogos...\n\n"

GAMES.each_with_index do |game, index|
  print "#{(index + 1).to_s.rjust(2)}. "
  insert_game(game)
end

puts "\nConcluído."
