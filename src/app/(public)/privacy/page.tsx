import { Policy } from "@/components/public/policy";
import { pageMetadata } from "@/lib/seo";
export const generateMetadata = () => pageMetadata("Privacy policy", "A practical notice about the personal data used to operate Hotdata, with Nigerian data protection rights in mind.", "/privacy");
const policy = {
  "title": "Privacy policy",
  "intro": "A practical notice about the personal data used to operate Hotdata, with Nigerian data protection rights in mind.",
  "privacy": true,
  "sections": [
    {
      "title": "Data we use",
      "paragraphs": [
        "Account data includes your name, email, Nigerian phone number, verification records and consent version. Security data includes password and PIN hashes, session/device information and hashed IP identifiers used for account protection.",
        "Service records include funding references, wallet and ledger entries, purchase recipient numbers, saved beneficiaries, notifications and support messages. Manual funding may include the proof you upload. Gateways handle card details; do not send full card numbers to support."
      ]
    },
    {
      "title": "Why we use it",
      "paragraphs": [
        "We use data to create and protect accounts, process funding and purchases, maintain accurate records, reconcile uncertain results and provide support. Contractual necessity and applicable legal duties may support these uses.",
        "Security and fraud prevention may rely on legitimate interests balanced against your rights. Where consent is required, it must be freely given and withdrawable. The signup acknowledgement does not authorise unrelated marketing or unlimited use of your data."
      ]
    },
    {
      "title": "Who receives it",
      "paragraphs": [
        "Authorised payment gateways, data providers, email services and hosting/infrastructure processors receive the information necessary for their task. For example, a data provider needs the recipient number, plan and transaction reference.",
        "Access by staff is limited to operational responsibilities. Data may be disclosed to lawful authorities where required. We do not offer personal data for sale. Before using an overseas processor, the operator must assess and implement the applicable safeguards for international transfers."
      ]
    },
    {
      "title": "Cookies and local storage",
      "paragraphs": [
        "Essential httpOnly cookies hold session and security tokens. The browser may retain a pending purchase’s plan, recipient, quote and request key in sessionStorage to support safe retries. It does not store your transaction PIN there.",
        "This release does not enable advertising cookies or analytics tracking. If optional tracking is introduced, the notice and consent controls must be updated before it is enabled. Clearing storage may remove safe retry details; check purchase history before creating another request."
      ]
    },
    {
      "title": "Retention and security",
      "paragraphs": [
        "Account records are retained while needed to operate the account. Financial, security and dispute records may need longer retention under applicable duties. The operator must document the applicable retention periods and deletion schedule before launch.",
        "Passwords and PINs are hashed; provider credentials are encrypted. Access controls, protected sessions and immutable ledger records support security. No system can guarantee absolute security. Report suspected compromise through the privacy contact without sending secrets."
      ]
    },
    {
      "title": "Your choices and rights",
      "paragraphs": [
        "You may request access, correction, deletion, restriction or portability where applicable, object to relevant processing and withdraw consent for processing based on consent. Rights may be subject to lawful exceptions and proportionate identity verification.",
        "Use account security to request deletion, or contact the privacy email with a description of your request. Do not send identity documents unless support gives a secure, necessary verification method. Deletion is a reviewed request, not an immediate purge of required financial records.",
        "You may complain to the Nigeria Data Protection Commission if your concern is not resolved. This notice is prepared with the Nigeria Data Protection Act 2023 and relevant NDPR obligations in mind."
      ]
    },
    {
      "title": "Children and notice changes",
      "paragraphs": [
        "The service is intended for people legally able to hold an account and accept its terms. If a child’s data has been submitted without appropriate authorisation, contact the privacy team for review.",
        "The current notice version is displayed above. Material changes to data uses or recipients require an updated notice and any necessary new consent."
      ]
    }
  ]
};
export default function PolicyPage() { return <Policy {...policy} />; }
