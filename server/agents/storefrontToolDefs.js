// Tool schemas exposed to the storefront agent (Anthropic tool-use format).
export const STOREFRONT_TOOLS = [
  {
    name: 'get_storefront_audit',
    description: 'Fetch a summary of the current storefront: products, pages, and theme settings overview.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_theme_settings',
    description: 'Read the full settings_data.json from the active theme.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'update_theme_settings',
    description: 'Deep-merge updates into the active theme settings_data.json.',
    input_schema: {
      type: 'object',
      properties: {
        updates: {
          type: 'object',
          description: 'Nested object of settings keys and values to merge into current settings_data.json.',
        },
      },
      required: ['updates'],
    },
  },
  {
    name: 'get_pages',
    description: 'List all storefront pages (title, handle, published status, body HTML).',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_or_update_page',
    description: 'Create a new page or update an existing one (pass id to update).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Page ID for updates; omit to create.' },
        title: { type: 'string' },
        body_html: { type: 'string' },
        handle: { type: 'string' },
        published: { type: 'boolean' },
      },
      required: ['title', 'body_html'],
    },
  },
  {
    name: 'get_menus',
    description: 'Fetch all navigation menus and their items.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_collection',
    description: 'Create a new product collection.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        descriptionHtml: { type: 'string' },
        published: { type: 'boolean' },
      },
      required: ['title'],
    },
  },
  {
    name: 'publish_product',
    description: 'Set a product status to ACTIVE (publish it).',
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Shopify product GID or numeric ID.' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'scan_drive_for_product',
    description: 'Search Google Drive for files matching a query and return their text content for product extraction.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term to find relevant Drive files.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'delete_product',
    description: 'Permanently delete a product from the Shopify store.',
    input_schema: {
      type: 'object',
      properties: { productId: { type: 'string', description: 'Product GID or numeric ID' } },
      required: ['productId'],
    },
  },
  {
    name: 'unpublish_product',
    description: 'Set a product back to Draft (hide it from the storefront without deleting).',
    input_schema: {
      type: 'object',
      properties: { productId: { type: 'string' } },
      required: ['productId'],
    },
  },
  {
    name: 'update_product',
    description: 'Update an existing product\'s title, description, price, vendor, type, or tags.',
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product GID or numeric ID' },
        fields: {
          type: 'object',
          description: 'Fields to update: title, descriptionHtml, price, vendor, productType, tags',
        },
      },
      required: ['productId', 'fields'],
    },
  },
  {
    name: 'delete_page',
    description: 'Delete a page from the Shopify store.',
    input_schema: {
      type: 'object',
      properties: { pageId: { type: 'number', description: 'Numeric page ID' } },
      required: ['pageId'],
    },
  },
  {
    name: 'delete_collection',
    description: 'Delete a collection from the Shopify store.',
    input_schema: {
      type: 'object',
      properties: { collectionId: { type: 'string', description: 'Collection GID or numeric ID' } },
      required: ['collectionId'],
    },
  },
  {
    name: 'add_product_to_collection',
    description: 'Add a product to an existing collection.',
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        collectionId: { type: 'string' },
      },
      required: ['productId', 'collectionId'],
    },
  },
  {
    name: 'create_shopify_product',
    description: 'Create a product in Shopify from a draft object. Sets status to ACTIVE to publish immediately when instructed.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        descriptionHtml: { type: 'string' },
        price: { type: 'string', description: 'Price as a string e.g. "29.99".' },
        vendor: { type: 'string' },
        productType: { type: 'string' },
        status: { type: 'string', enum: ['DRAFT', 'ACTIVE'], description: 'Use ACTIVE to publish immediately.' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'descriptionHtml'],
    },
  },
  {
    name: 'run_ux_audit',
    description: 'Run a structured read-only UX audit of the storefront. Fetches theme settings, navigation menus, pages, collections, and products, then scores 5 UX dimensions (First Impression, Navigation, Trust Signals, Content Completeness, Design Consistency) each 0-10. Returns an overall score, per-dimension justifications and recommendations, top frictions, and top wins.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'run_product_clarity_audit',
    description: 'Audit all Shopify product listings for description quality, visual completeness, pricing clarity, and audience/keyword clarity. Infers target audience and business type from the listing data alone. Returns per-product scores and specific, actionable suggestions.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'run_discoverability_audit',
    description: 'Test whether an AI shopping agent would recommend the store products for realistic shopper queries. Generates 6 shopper queries, then uses a neutral Claude instance to rate product relevance for each. Returns an overall discoverability score, which products are never recommended, and specific improvement suggestions.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_themes',
    description: 'List all themes installed on the Shopify store. Each entry includes id, name, and role ("main" = currently active, "unpublished" = installed but inactive). Always call this before activate_theme to get the correct numeric theme id.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'activate_theme',
    description: 'Set a theme as the active storefront theme by its numeric id. Call list_themes first to find the id. If the requested theme is not in the installed list, tell the user they must install it from the Shopify Theme Store before it can be activated.',
    input_schema: {
      type: 'object',
      properties: {
        themeId: { type: 'string', description: 'Numeric theme ID returned by list_themes.' },
      },
      required: ['themeId'],
    },
  },
]
