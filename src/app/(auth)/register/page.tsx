import { AuthForm } from "@/components/auth/auth-form";
export default async function Page({searchParams}:{searchParams:Promise<{ref?:string}>}){const query=await searchParams;const referralCode=typeof query.ref==="string"&&/^[A-Za-z0-9_-]{8,32}$/.test(query.ref)?query.ref:"";return <AuthForm mode="register" referralCode={referralCode}/>;}
