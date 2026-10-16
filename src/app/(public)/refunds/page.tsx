import { Policy } from "@/components/public/policy";
import { pageMetadata } from "@/lib/seo";
export const generateMetadata = () => pageMetadata("Refund policy", "Know what happens when a purchase fails, remains processing or needs investigation.", "/refunds");
const policy = {
  "title": "Refund policy",
  "intro": "Know what happens when a purchase fails, remains processing or needs investigation.",
  "privacy": false,
  "sections": [
    {
      "title": "Confirmed failed purchases",
      "paragraphs": [
        "When a provider outcome is confirmed as failed and the purchase cannot safely continue, the purchase debit is returned to your Hotdata wallet. A refund ledger entry and the receipt record identify the amount and reference.",
        "A purchase refund restores the data purchase debit. It does not automatically reverse a separate gateway funding fee or send money back to your bank. Funding reversals are investigated separately."
      ]
    },
    {
      "title": "Processing or uncertain results",
      "paragraphs": [
        "Processing means delivery has not yet been conclusively confirmed or rejected. A timeout alone does not establish failure. We keep the purchase pending while status checks or support investigation continue.",
        "Do not repeatedly create new orders for the same intended purchase. Retry the original saved request, refresh its receipt or contact support with its reference. We do not promise a fixed reconciliation time where the provider cannot yet confirm the outcome."
      ]
    },
    {
      "title": "Successful deliveries and wrong numbers",
      "paragraphs": [
        "Successful delivery to the number and plan you confirmed is normally not reversible by Hotdata. If you entered an incorrect number or selected the wrong network, contact support promptly; recovery depends on what the provider can actually reverse.",
        "If you dispute a successful status, give the reference and a description of the issue. We will investigate provider confirmation rather than assume that a displayed status resolves every dispute. Your applicable statutory rights remain unaffected."
      ]
    },
    {
      "title": "Funding and duplicate concerns",
      "paragraphs": [
        "If funding is missing, include the gateway reference, amount and payment time. Never send full card details, passwords or verification codes. A verified gateway event is credited once; repeated webhooks do not create multiple credits.",
        "If you believe two separate requests charged you twice, provide both references. A repeat of the same request key returns the original purchase; two distinct request keys can represent two valid orders and need individual investigation."
      ]
    },
    {
      "title": "How to ask for help",
      "paragraphs": [
        "Contact the published support email or WhatsApp contact with the transaction reference, recipient number, amount and issue. Share only the information necessary for the query.",
        "Refund decisions use transaction, ledger, gateway and provider evidence. Support will explain the outcome and any next steps. Account closure and bank-payment reversal requests require separate review."
      ]
    }
  ]
};
export default function PolicyPage() { return <Policy {...policy} />; }
