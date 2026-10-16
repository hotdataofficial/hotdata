const {PrismaClient}=require("@prisma/client");
const Redis=require("ioredis");
const db=new PrismaClient();
const redis=new Redis(process.env.REDIS_URL,{lazyConnect:true,connectTimeout:5000,commandTimeout:5000,maxRetriesPerRequest:0,retryStrategy:null});
redis.on("error",()=>{});
(async()=>{
 let timer;
 try {
  await Promise.race([Promise.all([db.$queryRawUnsafe("SELECT 1"),(async()=>{await redis.connect();if(await redis.ping()!=="PONG")throw Error("Redis unavailable");})()]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Connection deadline")),12000);})]);
  const [pendingOrders,administrators]=await Promise.all([db.transaction.count({where:{type:"DATA",status:"PENDING"}}),db.user.count({where:{role:{in:["ADMIN","SUPER_ADMIN"]},deletedAt:null,status:"ACTIVE"}})]);
  console.log("HOTDATA_NETLIFY_CONNECTIONS "+JSON.stringify({postgres:true,redis:true,pendingOrders,administrators}));
 } catch {console.error("Hotdata database/Redis connection check failed; credentials are not logged.");process.exitCode=1;}
 finally {clearTimeout(timer);redis.disconnect();await db.$disconnect();}
})();
