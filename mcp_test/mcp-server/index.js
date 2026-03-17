import { exec } from 'child_process';
import express from 'express';
import dotenv from 'dotenv';
import { Octokit } from '@octokit/rest';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('MCP Server is running!');
});

// GitHub 연동 예시 엔드포인트
app.get('/github/user', async (req, res) => {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { data } = await octokit.rest.users.getAuthenticated();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Git 자동 커밋/푸시 엔드포인트
app.post('/api/git/commit-push', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: '커밋 메시지를 입력하세요.' });
  }
  // git add . && git commit -m "메시지" && git push
  exec(`git add . && git commit -m "${message}" && git push`, { cwd: process.cwd() }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || err.message });
    }
    res.json({ success: true, stdout });
  });
});

app.listen(port, () => {
  console.log(`MCP server listening on port ${port}`);
});
