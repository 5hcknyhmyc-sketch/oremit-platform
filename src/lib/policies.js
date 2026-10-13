// Starter policy templates for UK money service businesses.
// Templates only: each MSB must review and adapt them with its MLRO / compliance adviser.

const T = {
  aml: {
    title: 'AML & CTF policy',
    audience: 'Internal',
    body: `# Anti-money laundering and counter-terrorist financing policy — {{name}}

## 1. Purpose and scope
This policy sets out how {{name}} meets its obligations under the Proceeds of Crime Act 2002, the Terrorism Act 2000, the Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017 ("MLRs") and the Payment Services Regulations 2017. It applies to all directors, staff, agents and contractors.

## 2. Governance
- Nominated officer (MLRO): {{mlro}}
- The board approves this policy at least once a year and after any material change in the business.
- The MLRO reports to the board at least quarterly on alerts, SARs, training and control effectiveness.

## 3. Risk-based approach
We keep a business-wide risk assessment covering customers, countries, products, transactions and delivery channels. Controls are applied in proportion to the risk identified.

## 4. Customer due diligence (CDD)
- Identify and verify every customer before the first transfer, using reliable independent sources.
- Screen customers and recipients against sanctions and PEP lists at onboarding and on every transfer.
- Record the purpose of each transfer and the relationship to the recipient.
- Apply enhanced due diligence (EDD) for PEPs, high-risk third countries, high-risk customers, and transfers above £{{edd}}.
- Ask for evidence of source of funds for transfers above £{{sof}}.

## 5. Ongoing monitoring
All transfers are checked against automated monitoring rules before release. Alerts are reviewed by trained compliance staff. Held transfers are only released after a documented decision.

## 6. Suspicious activity reporting
- Staff must report any knowledge or suspicion of money laundering or terrorist financing to the MLRO through an internal SAR.
- The MLRO decides whether to submit a SAR to the National Crime Agency, and whether a Defence Against Money Laundering (DAML) request is needed before a transfer proceeds.
- Tipping off is a criminal offence. Staff must never tell a customer that a report has been made or is being considered.

## 7. Record keeping
CDD records and transaction records are kept for at least five years from the end of the business relationship.

## 8. Training
All staff complete AML training on joining and at least annually. Completion is recorded.

## 9. Review
Next review date: {{review}}.`,
  },
  bwra: {
    title: 'Business-wide risk assessment',
    audience: 'Internal',
    body: `# Business-wide risk assessment — {{name}}

| Risk area | Inherent risk | Key controls | Residual risk |
|---|---|---|---|
| Customers | Medium — mostly retail diaspora senders | ID & liveness checks, screening, risk scoring | Low |
| Countries | Medium/High depending on corridor ({{corridors}}) | Corridor rules, EDD for high-risk third countries | Medium |
| Products | Medium — cross-border cash-to-account and cash pickup | Limits per customer, purpose capture | Medium |
| Transactions | Medium — structuring and third-party funding risk | Velocity, cumulative and structuring rules | Low |
| Delivery channels | Medium — non-face-to-face app onboarding | Liveness, device checks, address verification | Low |

Owner: {{mlro}}. Reviewed annually or when we add a new corridor, product or channel.`,
  },
  cdd: {
    title: 'Customer due diligence procedure',
    audience: 'Internal',
    body: `# Customer due diligence procedure — {{name}}

## Standard CDD (every customer)
1. Full name, date of birth, residential address.
2. One photo ID (passport, UK driving licence or national ID card) plus selfie liveness check.
3. Sanctions and PEP screening on the customer and every recipient.
4. Purpose of transfer and relationship to recipient.

## Enhanced due diligence
Triggered by: PEP status, high-risk third country, high customer risk score, transfers above £{{edd}}, or any monitoring alert that is not resolved as a false positive.
- Source of funds evidence (payslips, bank statements, sale contracts).
- Source of wealth for PEPs.
- Senior management (MLRO) approval to continue the relationship.

## Simplified due diligence
Not used.`,
  },
  gdpr: {
    title: 'Privacy notice (UK GDPR)',
    audience: 'Customers',
    body: `# Privacy notice — {{name}}

We collect your identity details, contact details, transfer details and recipient details so that we can send your money and meet our legal duties to prevent financial crime.

**Lawful basis:** performing our contract with you, and legal obligations under money laundering regulations.

**Who we share with:** payout partners who deliver your money, identity verification and screening providers, and law enforcement where the law requires it.

**How long we keep it:** at least five years after our relationship ends, as money laundering regulations require.

**Your rights:** access, correction, deletion where the law allows, and complaint to the Information Commissioner's Office (ico.org.uk).`,
  },
  fraud: {
    title: 'Fraud awareness guide',
    audience: 'Customers',
    body: `# Stay safe when sending money — {{name}}

Before you send, stop and check:
- **Has someone asked you to send this money?** Fraudsters pose as relatives, partners met online, banks, HMRC or the police.
- **Have you met the person you're sending to?** Romance and investment scams often start online.
- **Are you being rushed?** A real organisation will never pressure you to pay immediately.
- **Were you promised high returns?** Crypto and investment "opportunities" are a common scam.

If something feels wrong, stop the transfer and call us. Once money is paid out abroad it is usually impossible to recover.`,
  },
  complaints: {
    title: 'Complaints procedure',
    audience: 'Customers',
    body: `# Complaints procedure — {{name}}

1. Contact us by email or phone. We acknowledge every complaint within 3 business days.
2. We send a final response within 15 business days for payment services complaints (35 days in exceptional cases, and we will tell you why).
3. If you're unhappy with our response, you can refer your complaint to the Financial Ombudsman Service free of charge within six months of our final response: financial-ombudsman.org.uk.`,
  },
}

export function defaultPolicies(t) {
  const review = new Date(Date.now() + 365 * 86400000).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const fill = (s) => s
    .replaceAll('{{name}}', t.name)
    .replaceAll('{{mlro}}', t.compliance?.mlro || 'the MLRO')
    .replaceAll('{{edd}}', t.compliance?.eddThreshold ?? 5000)
    .replaceAll('{{sof}}', t.compliance?.sofThreshold ?? 2000)
    .replaceAll('{{corridors}}', (t.corridors || []).map((c) => c.cur).join(', '))
    .replaceAll('{{review}}', review)
  return Object.entries(T).map(([key, p]) => ({
    key, title: p.title, audience: p.audience,
    versions: [{ v: 1, body: fill(p.body), at: Date.now(), by: 'Template', approvedBy: null }],
  }))
}
