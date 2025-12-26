// Minimal TypeScript handler - no imports
export default function handler(req: any, res: any) {
  res.status(200).json({
    message: 'Hello from TypeScript!',
    time: new Date().toISOString()
  });
}
