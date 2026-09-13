import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { errorHandler } from "./Middlewares/Error.middleware.js"
import { env } from "./config/env.js"

const app = express()

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

//routes import
import userRouter from './Routes/User.route.js'
import serverRouter from './Routes/Server.route.js'
import channelRouter from './Routes/Channel.route.js'
import messageRouter from './Routes/Message.route.js'

//routes usage
app.use("/api/v1/users", userRouter)
app.use("/api/v1/server", serverRouter)
app.use("/api/v1/channels", channelRouter)
app.use("/api/v1/messages", messageRouter)

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
