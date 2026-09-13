import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import swaggerUi from "swagger-ui-express"
import { errorHandler } from "./Middlewares/Error.middleware.js"
import { env } from "./config/env.js"
import { apiLimiter } from "./Middlewares/RateLimit.middleware.js"
import { openapiSpecification } from "./config/openapi.js"
import { isRedisReady } from "./config/redis.js"
import { isElasticsearchReady } from "./config/elasticsearch.js"

const app = express()

app.set("trust proxy", 1)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "same-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
        },
    },
}))
app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

app.get("/", (_req, res) => {
    res.send("<h1>Server is running</h1>")
})

app.get("/api/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        redis: isRedisReady() ? "connected" : "unavailable",
        elasticsearch: isElasticsearchReady() ? "connected" : "unavailable",
    })
})

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpecification, { explorer: true }))

//routes import
import userRouter from './Routes/User.route.js'
import serverRouter from './Routes/Server.route.js'
import channelRouter from './Routes/Channel.route.js'
import messageRouter from './Routes/Message.route.js'
import uploadRouter from './Routes/Upload.route.js'
import searchRouter from './Routes/Search.route.js'

//routes usage
app.use("/api/v1", apiLimiter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/server", serverRouter)
app.use("/api/v1/channels", channelRouter)
app.use("/api/v1/messages", messageRouter)
app.use("/api/v1/uploads", uploadRouter)
app.use("/api/v1/search", searchRouter)

app.use((req, res) => {
    res.status(404).json({
        statusCode: 404,
        data: null,
        message: "Route not found",
        success: false,
    })
})

app.use(errorHandler)

export { app};
