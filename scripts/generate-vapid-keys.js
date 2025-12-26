#!/usr/bin/env node

/**
 * Generate VAPID keys for Web Push notifications
 *
 * Run: node scripts/generate-vapid-keys.js
 *
 * Then add the output to your .env file and Vercel environment variables
 */

const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('===========================================');
console.log('VAPID Keys Generated Successfully!');
console.log('===========================================');
console.log('');
console.log('Add these to your .env file:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:dyoung1946@gmail.com');
console.log('');
console.log('===========================================');
console.log('Also add to Vercel Dashboard:');
console.log('Settings > Environment Variables');
console.log('===========================================');
