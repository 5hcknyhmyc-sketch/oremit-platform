// Customer email templates. Each MSB gets this default set at onboarding and can edit it
// (onboarding step "Emails", later Settings → Emails). Variables are replaced at send time.

export const EMAIL_VARS = ['{{customer.first_name}}', '{{brand.name}}', '{{tx.reference}}', '{{tx.send_amount}}', '{{tx.receive_amount}}', '{{tx.recipient}}', '{{tx.eta}}', '{{bank.sort_code}}', '{{bank.account}}', '{{support.email}}']

export const DEFAULT_EMAILS = [
  { id: 'welcome', event: 'Account created', subject: 'Welcome to {{brand.name}}', body: 'Hi {{customer.first_name}},\n\nYour {{brand.name}} account is ready. Verify your identity once and you can start sending money in minutes.\n\nNeed help? Reply to this email or contact {{support.email}}.' },
  { id: 'kyc_verified', event: 'Identity verified', subject: 'You are verified — start sending', body: 'Hi {{customer.first_name}},\n\nYour identity check is complete. You can now send money with {{brand.name}}.' },
  { id: 'kyc_more', event: 'More information needed', subject: 'We need one more thing from you', body: 'Hi {{customer.first_name}},\n\nTo finish verifying your account we need a little more information. Open the app to see what is outstanding.' },
  { id: 'pay_instructions', event: 'Transfer created — how to pay', subject: 'Pay {{tx.send_amount}} to complete transfer {{tx.reference}}', body: 'Hi {{customer.first_name}},\n\nTo send {{tx.receive_amount}} to {{tx.recipient}}, please pay {{tx.send_amount}} by bank transfer:\n\nSort code: {{bank.sort_code}}\nAccount: {{bank.account}}\nReference: {{tx.reference}}\n\nUse the reference exactly so we can match your payment straight away.' },
  { id: 'pay_received', event: 'Payment received', subject: 'Payment received for {{tx.reference}}', body: 'Hi {{customer.first_name}},\n\nWe have received your payment of {{tx.send_amount}}. Your transfer to {{tx.recipient}} is now being processed.' },
  { id: 'on_hold', event: 'Transfer under review', subject: 'Your transfer {{tx.reference}} is being reviewed', body: 'Hi {{customer.first_name}},\n\nYour transfer is with our compliance team for a routine check. Most reviews finish the same working day. We will email you as soon as it moves on.' },
  { id: 'released', event: 'Transfer released / sent to partner', subject: 'Your money is on its way', body: 'Hi {{customer.first_name}},\n\nYour transfer {{tx.reference}} has been released and sent to our payout partner. Expected arrival: {{tx.eta}}.' },
  { id: 'paid', event: 'Paid out to recipient', subject: '{{tx.recipient}} has received your money', body: 'Hi {{customer.first_name}},\n\n{{tx.receive_amount}} has been paid to {{tx.recipient}}. Thank you for sending with {{brand.name}}.' },
  { id: 'refunded', event: 'Transfer refunded', subject: 'Transfer {{tx.reference}} refunded', body: 'Hi {{customer.first_name}},\n\nWe were unable to complete transfer {{tx.reference}}. {{tx.send_amount}} has been refunded to the account you paid from.' },
]

export const defaultEmails = () => DEFAULT_EMAILS.map((e) => ({ ...e }))

export function renderEmail(tpl, ctx) {
  const map = {
    '{{customer.first_name}}': ctx.customer || 'Bilal', '{{brand.name}}': ctx.brand || 'Your brand', '{{tx.reference}}': ctx.ref || 'TR-10492',
    '{{tx.send_amount}}': ctx.send || '£500.00', '{{tx.receive_amount}}': ctx.receive || 'PKR 184,250', '{{tx.recipient}}': ctx.recipient || 'Ayesha Khan', '{{tx.eta}}': ctx.eta || 'within minutes',
    '{{bank.sort_code}}': ctx.sort || '04-00-75', '{{bank.account}}': ctx.account || '12345678', '{{support.email}}': ctx.support || 'support@example.co.uk',
  }
  const sub = (s) => Object.entries(map).reduce((acc, [k, v]) => acc.split(k).join(v), s || '')
  return { subject: sub(tpl.subject), body: sub(tpl.body) }
}
