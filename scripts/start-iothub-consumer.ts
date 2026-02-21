import { startIoTHubConsumer } from '../lib/iothub-consumer'
import { logInfo, logError } from '../lib/logger'

async function main() {
  logInfo('Starting IoT Hub consumer process')

  const stop = await startIoTHubConsumer()

  // Graceful shutdown
  const shutdown = async () => {
    try {
      logInfo('Shutting down IoT Hub consumer')
      await stop()
      process.exit(0)
    } catch (err) {
      logError(err as Error, { context: 'Error during consumer shutdown' })
      process.exit(1)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  logError(err as Error, { context: 'Unhandled error in consumer process' })
  process.exit(1)
})
