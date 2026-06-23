const FIFA_FLAG: Record<string, string> = {
  // CONCACAF
  USA: '🇺🇸', MEX: '🇲🇽', CAN: '🇨🇦', CRC: '🇨🇷', JAM: '🇯🇲', HON: '🇭🇳', PAN: '🇵🇦',
  CUR: '🇨🇼', HAI: '🇭🇹',
  // CONMEBOL
  BRA: '🇧🇷', ARG: '🇦🇷', URU: '🇺🇾', COL: '🇨🇴', ECU: '🇪🇨', VEN: '🇻🇪',
  CHI: '🇨🇱', PAR: '🇵🇾', BOL: '🇧🇴', PER: '🇵🇪',
  // Europa
  ESP: '🇪🇸', FRA: '🇫🇷', GER: '🇩🇪', POR: '🇵🇹', ITA: '🇮🇹',
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', BEL: '🇧🇪', NED: '🇳🇱', SUI: '🇨🇭', AUT: '🇦🇹',
  CRO: '🇭🇷', SRB: '🇷🇸', SLO: '🇸🇮', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', DEN: '🇩🇰',
  CZE: '🇨🇿', SVK: '🇸🇰', ALB: '🇦🇱', GEO: '🇬🇪', HUN: '🇭🇺',
  TUR: '🇹🇷', ROU: '🇷🇴', POL: '🇵🇱', NOR: '🇳🇴', GRE: '🇬🇷',
  WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', UKR: '🇺🇦', ISL: '🇮🇸', FIN: '🇫🇮', SWE: '🇸🇪',
  // África
  MAR: '🇲🇦', SEN: '🇸🇳', NGA: '🇳🇬', EGY: '🇪🇬', CIV: '🇨🇮',
  CMR: '🇨🇲', GHA: '🇬🇭', TUN: '🇹🇳', RSA: '🇿🇦', ALG: '🇩🇿',
  MLI: '🇲🇱', ANG: '🇦🇴', MOZ: '🇲🇿', ZIM: '🇿🇼',
  COD: '🇨🇩', COG: '🇨🇬', TAN: '🇹🇿', ZAM: '🇿🇲', UGA: '🇺🇬',
  COM: '🇰🇲', BFA: '🇧🇫', GUI: '🇬🇳', GAB: '🇬🇦', BEN: '🇧🇯',
  // Ásia / Oceania
  JPN: '🇯🇵', KOR: '🇰🇷', SAU: '🇸🇦', KSA: '🇸🇦', IRN: '🇮🇷', AUS: '🇦🇺',
  QAT: '🇶🇦', NZL: '🇳🇿', BIH: '🇧🇦', JOR: '🇯🇴', TJK: '🇹🇯',
  UAE: '🇦🇪', CPV: '🇨🇻',
  UZB: '🇺🇿', KGZ: '🇰🇬', IDN: '🇮🇩', IND: '🇮🇳', IRQ: '🇮🇶',
  CHN: '🇨🇳', VIE: '🇻🇳', THA: '🇹🇭', SYR: '🇸🇾',
}

export function getTeamFlag(code: string): string {
  return FIFA_FLAG[code] ?? '🏳️'
}
