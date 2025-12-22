/**
 * Appwrite Service - Google OAuth Authentication
 * 
 * This module handles authentication with Appwrite's OAuth2 provider (Google).
 */

import { Client, Account } from 'appwrite';

// Initialize Appwrite Client
const client = new Client();

client
  .setEndpoint('https://nyc.cloud.appwrite.io/v1')
  .setProject('6943f971000bc0de129a');

export const account = new Account(client);

/**
 * Initiates Google OAuth2 login flow
 * Redirects user to Google for authentication
 */
export async function loginWithGoogle() {
  try {
    account.createOAuth2Session(
      'google',
      `${window.location.origin}/`,        // Success redirect URL
      `${window.location.origin}/login`    // Failure redirect URL
    );
  } catch (error) {
    console.error('Google login failed:', error);
    throw error;
  }
}

/**
 * Gets the current authenticated user from Appwrite
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const user = await account.get();
    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Logs out the current user by deleting their session
 */
export async function appwriteLogout() {
  try {
    await account.deleteSession('current');
  } catch (error) {
    console.error('Logout failed:', error);
  }
}
