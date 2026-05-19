// socket/index.ts
import { Server } from 'socket.io'
import { SocketHandler } from './socket.handler'

export const startSocket = (io: Server) => {
  const handler = new SocketHandler(io)
  handler.start()
}
