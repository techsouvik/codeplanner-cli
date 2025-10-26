/**
 * Sample Project for CodePlanner Testing
 * 
 * This is a sample TypeScript project used for testing the CodePlanner CLI.
 * It contains various code patterns and structures that can be used to
 * test indexing, planning, and error analysis functionality.
 */

// User interface definition
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  isActive: boolean;
}

// User service class for managing users
export class UserService {
  private users: User[] = [];
  private nextId: number = 1;

  /**
   * Adds a new user to the service
   * @param userData - User data without ID
   * @returns The created user with assigned ID
   */
  addUser(userData: Omit<User, 'id' | 'createdAt'>): User {
    const user: User = {
      id: this.nextId.toString(),
      name: userData.name,
      email: userData.email,
      createdAt: new Date(),
      isActive: userData.isActive
    };
    
    this.users.push(user);
    this.nextId++;
    
    return user;
  }

  /**
   * Retrieves all users
   * @returns Array of all users
   */
  getUsers(): User[] {
    return [...this.users];
  }

  /**
   * Finds a user by ID
   * @param id - User ID to search for
   * @returns User if found, undefined otherwise
   */
  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  /**
   * Updates an existing user
   * @param id - User ID to update
   * @param updates - Partial user data to update
   * @returns Updated user if found, undefined otherwise
   */
  updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): User | undefined {
    const userIndex = this.users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return undefined;
    }
    
    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates
    };
    
    return this.users[userIndex];
  }

  /**
   * Removes a user by ID
   * @param id - User ID to remove
   * @returns true if user was removed, false if not found
   */
  removeUser(id: string): boolean {
    const userIndex = this.users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return false;
    }
    
    this.users.splice(userIndex, 1);
    return true;
  }

  /**
   * Gets active users only
   * @returns Array of active users
   */
  getActiveUsers(): User[] {
    return this.users.filter(user => user.isActive);
  }
}

// Utility functions for user processing
export function processUsers(users: User[]): string[] {
  return users.map(user => user.name);
}

export function validateUserEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function formatUserName(user: User): string {
  return `${user.name} (${user.email})`;
}

// Error handling utilities
export class UserError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'UserError';
  }
}

export function handleUserError(error: unknown): string {
  if (error instanceof UserError) {
    return `User Error [${error.code}]: ${error.message}`;
  }
  
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  
  return 'Unknown error occurred';
}

// Main application entry point
export function main(): void {
  const userService = new UserService();
  
  // Add some sample users
  const user1 = userService.addUser({
    name: 'John Doe',
    email: 'john@example.com',
    isActive: true
  });
  
  const user2 = userService.addUser({
    name: 'Jane Smith',
    email: 'jane@example.com',
    isActive: false
  });
  
  console.log('Sample users created:', userService.getUsers().length);
  console.log('Active users:', userService.getActiveUsers().length);
}

// Export types for external use
export type { User };
