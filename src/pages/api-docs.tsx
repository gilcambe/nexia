import React from 'react';
import { Prism as SyntaxHighlighter } from 'prism-react-renderer';
import theme from 'prism-react-renderer/themes/nightOwl';

const ApiDocs: React.FC = () => {
  const curlExample = `curl -X POST "http://localhost:3000/cortex" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/cortex",
    api_key="your-api-key"
)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`;

  const vscodeContinueExample = `// In your VS Code Continue configuration
{
  "models": [
    {
      "title": "Cortex API",
      "provider": "openai",
      "model": "gpt-3.5-turbo",
      "apiBase": "http://localhost:3000/cortex",
      "apiKey": "your-api-key"
    }
  ]
}`;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">API Usage Examples</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">cURL Example</h2>
        <SyntaxHighlighter language="bash" style={theme}>
          {curlExample}
        </SyntaxHighlighter>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Python Example</h2>
        <SyntaxHighlighter language="python" style={theme}>
          {pythonExample}
        </SyntaxHighlighter>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">VS Code Continue Example</h2>
        <SyntaxHighlighter language="json" style={theme}>
          {vscodeContinueExample}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default ApiDocs;
