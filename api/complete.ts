import { Copilot } from "monacopilot";
import { VercelRequest, VercelResponse } from "@vercel/node";

const copilot = new Copilot(process.env.OPENAI_API_KEY!, {
  provider: "openai",
  model: "gpt-4o-mini",
});

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const completion = await copilot.complete({
    body: req.body,
  });
  return res.json(completion);
};

export default handler;
