//SessionManager.js
export default class SessionManager {
  constructor() {
    this.userToSocket = new Map();
    this.socketToUser = new Map();
  }

  addUser(userId, socketId) {
    if (!this.userToSocket.has(userId)) {
      this.userToSocket.set(userId, new Set());
    }

    this.userToSocket.get(userId).add(socketId);
    this.socketToUser.set(socketId, userId);
  }

  removeSocket(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;

    const socketSet = this.userToSocket.get(userId);
    socketSet?.delete(socketId);

    if (socketSet?.size === 0) {
      this.userToSocket.delete(userId);
    }

    this.socketToUser.delete(socketId);
  }

  removeUser(userId) {
    const socketSet = this.userToSocket.get(userId);
    if (!socketSet) return;

    for (const socketId of socketSet) {
      this.socketToUser.delete(socketId);
    }

    this.userToSocket.delete(userId);
  }

  // Check if a user is currently connected (at least 1 active socket)
  isUserOnline(userId) {
    return this.userToSocket.has(userId) && this.userToSocket.get(userId).size > 0;
  }

  // Get all active socket IDs for a given user (for targeting)
  getUserSockets(userId) {
    const set = this.userToSocket.get(userId);
    return set ? Array.from(set) : [];
  }

  // Get the userId for a given socketId
  getUserId(socketId) {
    return this.socketToUser.get(socketId) || null;
  }
}
