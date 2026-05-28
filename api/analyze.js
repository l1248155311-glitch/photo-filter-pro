import { OpenAI } from "openai";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageBase64, filename } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'Missing image data' });
    }

    try {
        const client = new OpenAI({
            apiKey: process.env.DOUBAO_API_KEY,
            baseURL: "https://ark.cn-beijing.volces.com/api/v3",
        });

        const prompt = `你是一位专业的摄影点评师。请对这张照片进行详细点评，包括：

1. 整体评价（1-2句话总结）
2. 构图分析（三分法、引导线、对称性、主体位置等）
3. 光影评价（光线方向、质感、明暗对比）
4. 色彩表现（饱和度、色调、白平衡）
5. 技术质量（清晰度、曝光、噪点）
6. 情感表达（氛围、故事感、感染力）
7. 改进建议（2-3条具体建议）
8. 评分（满分100分）

请用专业但易懂的语言点评。`;

        const response = await client.chat.completions.create({
            model: "doubao-1.5-vision-pro-250328",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: imageBase64
                            }
                        },
                        {
                            type: "text",
                            text: prompt
                        }
                    ]
                }
            ],
            max_tokens: 2048,
        });

        const review = response.choices[0].message.content;

        return res.status(200).json({
            success: true,
            filename: filename,
            review: review,
            usage: response.usage
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message
        });
    }
}

export const config = {
    runtime: "nodejs",
    maxDuration: 30,
};
