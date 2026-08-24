import nodemailer, { type Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

interface Mensagem {
  para: string
  assunto: string
  texto: string
}

let transporte: Transporter | null | undefined

/**
 * Monta o transporte SMTP na primeira vez que for preciso, ou devolve null se o
 * clube não configurou SMTP.
 *
 * Clube pequeno muitas vezes não tem servidor de e-mail, e travar a redefinição
 * de senha por causa disso deixaria a diretoria sem saída. Sem SMTP, o sistema
 * segue funcionando e o link vai para o log do servidor — em produção, a saída
 * prevista é a diretoria gerar o link pelo painel (PLANO.md §11).
 */
function obterTransporte(): Transporter | null {
  if (transporte !== undefined) return transporte

  const config = useRuntimeConfig()
  if (!config.smtpHost) {
    transporte = null
    return transporte
  }

  const opcoes: SMTPTransport.Options = {
    host: String(config.smtpHost),
    port: Number(config.smtpPort) || 587,
    // A porta 465 usa TLS desde o primeiro byte; as demais negociam com STARTTLS.
    secure: Number(config.smtpPort) === 465,
    auth: config.smtpUser
      ? { user: String(config.smtpUser), pass: String(config.smtpPassword) }
      : undefined,
  }

  transporte = nodemailer.createTransport(opcoes)

  return transporte
}

/** Devolve true se o e-mail saiu de fato. */
export async function enviarEmail(mensagem: Mensagem): Promise<boolean> {
  const transporte = obterTransporte()
  const config = useRuntimeConfig()

  if (!transporte) {
    console.warn(
      `[email] SMTP não configurado; mensagem para ${mensagem.para} não foi enviada.\n`
      + `[email] Assunto: ${mensagem.assunto}\n${mensagem.texto}`,
    )
    return false
  }

  await transporte.sendMail({
    from: String(config.smtpFrom || config.smtpUser),
    to: mensagem.para,
    subject: mensagem.assunto,
    text: mensagem.texto,
  })

  return true
}
