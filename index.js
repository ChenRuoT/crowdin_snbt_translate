const crowdinModule = require('@crowdin/app-project-module');
const path = require('path');
const { SNBT, CompoundTag, StringTag, ListTag } = require('@bdsx/snbt');

// Helper to simplify NBT tag to plain JS object
function simplify(tag) {
  if (tag.type === 'compound') {
    const obj = {};
    for (const [key, val] of Object.entries(tag.value)) {
      obj[key] = simplify(val);
    }
    return obj;
  } else if (tag.type === 'list') {
    return tag.value.map(simplify);
  } else if (tag.type === 'string') {
    return tag.value;
  } else {
    // Ignore other types or throw error if needed
    return null;
  }
}

// Helper to build NBT tag from plain JS object
function buildTag(obj) {
  if (typeof obj === 'string') {
    return StringTag.allocateWith(obj);
  } else if (Array.isArray(obj)) {
    const list = ListTag.allocate('string');
    obj.forEach(item => {
      if (typeof item === 'string') {
        list.push(StringTag.allocateWith(item));
      }
    });
    return list;
  } else if (typeof obj === 'object' && obj !== null) {
    const compound = CompoundTag.allocate();
    for (const [key, val] of Object.entries(obj)) {
      const childTag = buildTag(val);
      if (childTag) {
        compound.set(key, childTag);
      }
    }
    return compound;
  }
  return null;
}

// Helper to extract translatable strings
function extractStrings(obj, prefix = '', file) {
  const strings = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      strings.push({
        identifier: fullKey,
        text: val,
        context: `From ${file.name} - ${fullKey}`,
      });
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        if (typeof item === 'string') {
          strings.push({
            identifier: `${fullKey}[${idx}]`,
            text: item,
            context: `From ${file.name} - ${fullKey}[${idx}]`,
          });
        }
      });
    }
    // No recursion needed as structure is flat based on sample
  }
  return strings;
}

// Helper to set value by path (e.g., "quest.0D6D45DBA64E612D.quest_desc[0]")
function setByPath(obj, path, value) {
  const parts = path.replace(/\[(\d+)\]/g, '.[$1]').split('.').filter(p => p);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part.startsWith('[')) {
      const idx = parseInt(part.slice(1));
      if (!Array.isArray(current[parts[i-1]])) {
        current[parts[i-1]] = [];
      }
      current = current[parts[i-1]][idx];
    } else {
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }
  }
  const last = parts[parts.length - 1];
  if (last.startsWith('[')) {
    const idx = parseInt(last.slice(1));
    current[idx] = value;
  } else {
    current[last] = value;
  }
}

const configuration = {
  baseUrl: `https://${process.env.VERCEL_URL || 'localhost:3000'}`,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  name: 'SNBT File Processor',
  identifier: 'snbt-file-processor',
  description: 'Crowdin App for processing Minecraft .snbt files',
  imagePath: path.join(__dirname, 'logo.png'),
  dbFolder: path.join(__dirname, 'db'), // 使用默认SQLite存储
  fileProcessing: {
    extensions: ['snbt'],
    parseFile: async ({ content, file }) => {
      try {
        const parsedTag = SNBT.parse(content);
        const simplified = simplify(parsedTag);
        const strings = extractStrings(simplified, '', file);
        return { strings };
      } catch (error) {
        throw new Error(`Failed to parse .snbt file: ${error.message}`);
      }
    },
    applyTranslations: async ({ translations, original }) => {
      try {
        const parsedTag = SNBT.parse(original);
        let simplified = simplify(parsedTag);
        for (const trans of translations) {
          setByPath(simplified, trans.identifier, trans.text);
        }
        const newTag = buildTag(simplified);
        return SNBT.stringify(newTag);
      } catch (error) {
        throw new Error(`Failed to apply translations: ${error.message}`);
      }
    },
  },
  enableStatusPage: {
    database: true,
    filesystem: true,
    rateLimit: 10,
  },
  onError: (error, context) => {
    console.error('Error occurred:', error);
    if (context) {
      console.log('Context:', {
        jwtPayload: context.jwtPayload,
        clientId: context.clientId,
        crowdinId: context.crowdinId,
      });
    }
  },
  logger: {
    enabled: true,
  },
};

crowdinModule.createApp(configuration);