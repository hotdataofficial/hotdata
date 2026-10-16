import { Policy } from "@/components/public/policy";
import { pageMetadata } from "@/lib/seo";
export const generateMetadata = () => pageMetadata("Terms of service", "These terms explain how to use your Hotdata account, wallet and data services.", "/terms");
const policy = {
  "title": "Terms of service",
  "intro": "These terms explain how to use your Hotdata account, wallet and data services.",
  "privacy": false,
  "sections": [
    {
      "title": "Using Hotdata",
      "paragraphs": [
        "Hotdata provides a prepaid-wallet interface for purchasing mobile data through available third-party providers. You must be legally able to enter these terms, provide accurate account details and use the service lawfully. Availability depends on the network and provider.",
        "Create your own account and protect your password, verification codes and transaction PIN. Contact support promptly if you suspect unauthorised access. Do not share an account or use another person’s credentials."
      ]
    },
    {
      "title": "Plans and prices",
      "paragraphs": [
        "Plan size, type, validity and price are displayed before confirmation. The server checks the current selling price and availability again. A changed quoted price must be reviewed before a new purchase.",
        "You are responsible for checking the recipient number and network. Phone prefixes are only suggestions because numbers can move between networks. A confirmed delivery to the number you entered may not be reversible."
      ]
    },
    {
      "title": "Wallet funding",
      "paragraphs": [
        "Your wallet records prepaid value for purchases. It is not presented as a bank account, savings account or investment product, and earns no interest. Available funding methods and applicable fees appear in your account.",
        "Funding is credited after gateway verification or manual review, as applicable. A bank receipt alone does not prove that Hotdata received the payment. Reversed payments, disputes and suspected fraud may require investigation. Withdrawal and transfer options are available only when explicitly enabled and subject to displayed conditions."
      ]
    },
    {
      "title": "Purchase status and refunds",
      "paragraphs": [
        "A submitted purchase may be processing while delivery is being confirmed. A successful status represents confirmation from the provider; keep the reference for disputes. Confirmed failed purchases are refunded to the wallet.",
        "An uncertain outcome must be investigated before a refund or another delivery attempt. Use the same saved request when retrying a lost response. A separate request can create another purchase. Read the Refund Policy for details."
      ]
    },
    {
      "title": "Acceptable use and account restrictions",
      "paragraphs": [
        "Do not exploit pricing errors, evade limits, submit fraudulent payments, abuse APIs, access other users’ records or interfere with security controls. Accounts may be restricted where necessary to investigate suspected fraud or comply with law.",
        "Where lawful and practical, support will explain a restriction and how to raise a concern. Account restrictions do not remove your rights to dispute a transaction or exercise privacy rights."
      ]
    },
    {
      "title": "Service interruptions and disputes",
      "paragraphs": [
        "Networks, providers, gateways and connectivity can cause delays or interruptions. No fixed delivery time is guaranteed. We will investigate reported errors using your transaction reference.",
        "Raise concerns through the published support contact. These terms do not exclude rights or remedies that cannot lawfully be excluded. Applicable Nigerian law governs the service, subject to mandatory consumer protections."
      ]
    },
    {
      "title": "Changes and closing your account",
      "paragraphs": [
        "Material changes will be communicated through appropriate account or site notices. The displayed policy version identifies the current terms. Changes do not retroactively change the recorded price of a confirmed purchase.",
        "You can request account deletion through account security or the privacy contact. Outstanding transactions, disputes and legally required records may need to be resolved or retained."
      ]
    }
  ]
};
export default function PolicyPage() { return <Policy {...policy} />; }
