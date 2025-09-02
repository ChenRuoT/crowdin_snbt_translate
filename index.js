const crowdinModule = require('@crowdin/app-project-module');
const fs = require('fs').promises;
const path = require('path');

function parseSNBT(snbtContent) {
  const strings = [];
  
  // 按行分割 SNBT 文件
  const lines = snbtContent.split('\n').map(line => line.trim()).filter(line => line);
  
  // 正则匹配 quest.<ID>.title 和 quest.<ID>.quest_desc
  const titleRegex = /(quest\.[0-9A-F]+\.title): *"(.*?)"/;
  const descRegex = /(quest\.[0-9A-F]+\.quest_desc): *\[([^\]]*)\]/;

  lines.forEach((line, index) => {
    // 匹配 title
    let match = line.match(titleRegex);
    if (match) {
      const key = match[1];
      let text = match[2].replace(/\\n/g, '\n'); // 还原换行符
      strings.push({
        key,
        text,
        context: `Line ${index + 1}` // 添加上下文信息
      });
    }

    // 匹配 quest_desc 数组
    match = line.match(descRegex);
    if (match) {
      const key = match[1];
      // 解析数组内容
      const arrayContent = match[2]
        .split('","')
        .map(item => item.replace(/^"|"$/g, '').replace(/\\n/g, '\n'));
      arrayContent.forEach((text, i) => {
        strings.push({
          key: `${key}[${i}]`,
          text,
          context: `Line ${index + 1}, Array index ${i}`
        });
      });
    }
  });

  return strings;
}

function serializeSNBT(originalContent, strings) {
  // 创建翻译映射
  const translationMap = {};
  strings.forEach(({ key, translation }) => {
    if (translation) {
      translationMap[key] = translation.replace(/\n/g, '\\n'); // 将换行符转回 \\n
    }
  });

  // 按行处理原始 SNBT
  const lines = originalContent.split('\n').map(line => line.trim()).filter(line => line);
  const resultLines = [];

  const titleRegex = /(quest\.[0-9A-F]+\.title): *"(.*?)"/;
  const descRegex = /(quest\.[0-9A-F]+\.quest_desc): *\[([^\]]*)\]/;

  lines.forEach(line => {
    let newLine = line;

    // 处理 title
    let match = line.match(titleRegex);
    if (match) {
      const key = match[1];
      if (translationMap[key]) {
        newLine = `${key}: "${translationMap[key]}"`;
      }
    }

    // 处理 quest_desc 数组
    match = line.match(descRegex);
    if (match) {
      const key = match[1];
      const arrayContent = match[2]
        .split('","')
        .map(item => item.replace(/^"|"$/g, '')); // 解析原始数组
      const translatedArray = arrayContent.map((_, index) => {
        const arrayKey = `${key}[${index}]`;
        return translationMap[arrayKey] ? `"${translationMap[arrayKey]}"` : `"${arrayContent[index]}"`;
      });
      newLine = `${key}: [${translatedArray.join(',')}]`;
    }

    resultLines.push(newLine);
  });

  return resultLines.join('\n');
}

function generatePreviewFile(file, strings) {
  // 生成简单的预览文件，显示源字符串
  return strings.map(s => `${s.key}: ${s.text}`).join('\n');
}

const configuration = {
  name: 'SNBT',
  identifier: 'Snbt',
  description: 'Providing support for .snbt files',
  baseUrl: `https://${process.env.VERCEL_URL}`,
  port: process.env.PORT || 8080,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  dbFolder: __dirname,
  imagePath: path.join(__dirname, 'logo.png'),
  detailPage: 'https://company.com/apps/sample',
  onInstall: async ({ organization, userId, client }) => {
    const promptRequest = {
      name: configuration.name,
      action: `custom:${configuration.identifier}`,
      config: {
        mode: 'advanced',
        prompt: ''
      }
    };

    if (client.organization) {
      await client.aiApi.addAiOrganizationPrompt(promptRequest);
    } else {
      await client.aiApi.addAiUserPrompt(userId, promptRequest);
    }
  },
  onUninstall: async (organization, allCredentials) => {
    console.log('Uninstalling app for organization:', organization);
  },
  scopes: [
    crowdinModule.Scope.PROJECTS
  ],
  defaultPermissions: {
    user: crowdinModule.UserPermissions.ALL_MEMBERS,
    project: crowdinModule.ProjectPermissions.RESTRICTED
  },
  customFileFormat: {
    filesFolder: __dirname,
    type: 'snbt',
    signaturePatterns: {
      fileName: '^.+\.snbt$'
    },
    parseFile: async (file, req, client, context, projectId) => {
      try {
        const snbtContent = await fs.readFile(file.path, 'utf-8');
        const strings = parseSNBT(snbtContent);
        return {
          strings,
          previewFile: generatePreviewFile(file, strings)
        };
      } catch (error) {
        return { error: `Failed to parse SNBT: ${error.message}` };
      }
    },
    buildFile: async (file, req, strings, client, context, projectId) => {
      try {
        const originalContent = await fs.readFile(file.path, 'utf-8');
        const contentFile = serializeSNBT(originalContent, strings);
        return { contentFile };
      } catch (error) {
        return { error: `Failed to build SNBT: ${error.message}` };
      }
    }
  }
};

crowdinModule.createApp(configuration);

const express = require('express');
const app = express();
crowdinModule.addCrowdinEndpoints(app, configuration);

app.listen(configuration.port, () => console.log(`SNBT File Format App started on port ${configuration.port}`));