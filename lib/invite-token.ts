import { randomBytes } from 'crypto'

/**
 * Gera um token de convite opaco, criptograficamente seguro, para o link
 * de convite reutilizável de um grupo.
 *
 * 24 bytes aleatórios codificados em base64url (sem padding) resultam em
 * uma string de 32 caracteres ([A-Za-z0-9_-]), ex:
 * "k3F9pQ7xN2bV8mZcL1tR4sJdY6wA0eHu".
 *
 * A probabilidade de colisão com 24 bytes de entropia é desprezível para o
 * volume esperado (pequeno grupo de amigos, dezenas de grupos no máximo).
 * Em caso de colisão, o INSERT em `groups` falha com 23505 e o caller deve
 * tentar gerar um novo token uma única vez antes de desistir (ver
 * app/api/groups/route.ts).
 */
export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url')
}
