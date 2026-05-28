export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const API_KEY = process.env.DOUBAO_API_KEY;

    if (API_KEY) {
        return res.status(200).json({
            status: 'configured',
            key_prefix: API_KEY.substring(0, 10) + '...',
            message: 'Environment variable is set correctly'
        });
    } else {
        return res.status(200).json({
            status: 'not_configured',
            message: 'DOUBAO_API_KEY is not set in Environment Variables'
        });
    }
}
