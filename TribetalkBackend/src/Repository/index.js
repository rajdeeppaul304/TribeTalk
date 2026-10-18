import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import { metrics } from "../config/metrics.js";


const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`, { monitorCommands: true })
        const connection = connectionInstance.connection
        const mongoClient = connection.getClient()
        const startedCommands = new Map()
        let poolSize = 0
        let checkedOut = 0
        mongoClient.on("commandStarted", (event) => {
            if (event.commandName === "hello" || event.commandName === "ismaster") return
            startedCommands.set(event.requestId, { operation: event.commandName, startedAt: process.hrtime.bigint() })
        })
        const finishCommand = (event, status) => {
            const started = startedCommands.get(event.requestId)
            if (!started) return
            startedCommands.delete(event.requestId)
            metrics.observeDependency("mongodb", started.operation, Number(process.hrtime.bigint() - started.startedAt) / 1_000_000, status)
        }
        mongoClient.on("commandSucceeded", (event) => finishCommand(event, "success"))
        mongoClient.on("commandFailed", (event) => finishCommand(event, "error"))
        mongoClient.on("connectionCreated", () => { poolSize += 1; metrics.setMongoPoolSize(poolSize) })
        mongoClient.on("connectionClosed", () => { poolSize = Math.max(0, poolSize - 1); metrics.setMongoPoolSize(poolSize) })
        mongoClient.on("connectionCheckedOut", () => { checkedOut += 1; metrics.setMongoPoolCheckedOut(checkedOut) })
        mongoClient.on("connectionCheckedIn", () => { checkedOut = Math.max(0, checkedOut - 1); metrics.setMongoPoolCheckedOut(checkedOut) })
        // Mongoose opens the initial connection before command monitoring
        // listeners are attached; seed the gauge with that baseline.
        poolSize = 1
        metrics.setMongoPoolSize(poolSize)
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1)
    }
}

export default connectDB
