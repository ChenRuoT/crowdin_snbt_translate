const crowdinModule = require('@crowdin/app-project-module');

const configuration = {
  name: 'Sample App',
  identifier: 'sample-app',
  description: 'Sample App description',
  baseUrl: `https://${process.env.VERCEL_URL}`,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  dbFolder: __dirname,
  imagePath: __dirname + '/' + 'logo.png',
  detailPage: 'https://company.com/apps/sample',
  postgreConfig: {
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    ssl: true
  },
    customMT: {
    translate: () => {
      console.log('translate');
    },
    validate: () => {
      console.log('validate');
    }
  },
  scopes: [
    crowdinModule.Scope.PROJECTS
  ],
  defaultPermissions: {
    user: crowdinModule.UserPermissions.ALL_MEMBERS,
    project: crowdinModule.ProjectPermissions.RESTRICTED
  },

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

    customFileFormat: {
    filesFolder: __dirname,
    type: 'type-xyz',
    signaturePatterns: {
      fileName: '.*.snbt',
      filecontent: '.*'
    },
    parseFile: async (file, req, client, context, projectId) => {
      // parse logic

      return {
        strings: [],
        previewFile: generatePreviewFile(req.file, strings),
      };
    },
    buildFile: async (file, req, strings, client, context, projectId) => {
      // build logic

      const contentFile = '<content>';
      return { contentFile }
    }
  }

};

crowdinModule.createApp(configuration);