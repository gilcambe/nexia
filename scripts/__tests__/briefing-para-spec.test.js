const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const nock = require('nock');

// Mock data for AI responses
const mockAiResponse = {
  success: {
    siteSpec: {
      name: 'Mock Site',
      tagline: 'Mock Tagline',
      sections: [
        { type: 'hero', image_query: 'Mock Hero Image' },
        { type: 'features', features: ['Feature 1', 'Feature 2'] },
      ],
    },
  },
  fallback: {
    siteSpec: {
      name: 'Fallback Site',
      tagline: 'Fallback Tagline',
      sections: [
        { type: 'hero', image_query: 'Fallback Hero Image' },
        { type: 'features', features: ['Fallback Feature 1', 'Fallback Feature 2'] },
      ],
    },
  },
};

describe('briefing-para-spec script', () => {
  const briefingFile = path.join(__dirname, 'briefing.md');
  const outputFile = path.join(__dirname, 'site.json');
  const tempDir = path.join(__dirname, 'temp');

  beforeAll(() => {
    // Create a temporary directory for test files
    fs.mkdirSync(tempDir, { recursive: true });
    // Create a sample briefing file
    fs.writeFileSync(briefingFile, 'Sample Briefing Content');
  });

  afterAll(() => {
    // Clean up temporary files and directory
    fs.unlinkSync(briefingFile);
    fs.unlinkSync(outputFile);
    fs.rmdirSync(tempDir, { recursive: true });
  });

  it('should generate site.json with AI response', () => {
    // Mock AI API to return success response
    nock('https://api.example.com')
      .post('/generate-site-spec')
      .reply(200, mockAiResponse.success);

    // Run the script
    execSync(`node ../briefing-para-spec.js ${briefingFile} ${outputFile}`, {
      cwd: __dirname,
    });

    // Verify site.json content
    const siteJson = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(siteJson.name).toBe('Mock Site');
    expect(siteJson.tagline).toBe('Mock Tagline');
    expect(siteJson.sections.length).toBe(2);
  });

  it('should generate site.json with fallback on AI failure', () => {
    // Mock AI API to return an error
    nock('https://api.example.com')
      .post('/generate-site-spec')
      .reply(500, { error: 'AI failed' });

    // Run the script
    execSync(`node ../briefing-para-spec.js ${briefingFile} ${outputFile}`, {
      cwd: __dirname,
    });

    // Verify site.json content (fallback)
    const siteJson = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(siteJson.name).toBe('Fallback Site');
    expect(siteJson.tagline).toBe('Fallback Tagline');
    expect(siteJson.sections.length).toBe(2);
  });
});
