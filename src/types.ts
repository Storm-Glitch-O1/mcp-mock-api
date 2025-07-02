import { z } from 'zod';
// Import MockApiServer to access its schema definitions for type inference
// This creates a slight awkwardness if MockApiServer also imports types from here,
// but for deriving handler input types it's a common pattern.
// Alternatively, schemas could be defined in a separate file and imported by both.
import type { MockApiServer } from './server.js'; // Use type import

export interface MockData {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  response: any;
  statusCode: number;
}

export interface MockStorage {
  [id: string]: MockData;
}

// Specific ContentItem types that our server will produce
export interface TextContentItem {
  type: 'text';
  text: string;
  [key: string]: any; // Add index signature to make it more assignable
  // title?: string; // Optional, if SDK defines/uses it
  // mimeType?: string; // Optional, if SDK defines/uses it
}

// For now, we only use TextContentItem. If others are needed, add them to a discriminated union:
// export type AppContentItem = TextContentItem; // | ImageContentItem | AudioContentItem;

// This is what our tool handlers will return, matching the SDK's expected ToolResponse structure.
export interface McpToolResponseContent {
  content: TextContentItem[]; // Array of our specific content items
  isError?: boolean;          // Optional field from SDK's ResponseMessage
  structuredContent?: Record<string, any>; // Optional
  [key: string]: any; // Add index signature to the response object itself
  // _meta?: Record<string, any>; // Optional, if needed
}


// Infer input types from the Zod schemas defined in MockApiServer
// The 'prototype' access is not needed if schemas are static or instance public readonly fields.
// Given they are public readonly instance fields:
export type CreateEndpointInput = z.infer<InstanceType<typeof MockApiServer>['createEndpointSchema']>;
export type GetEndpointInput = z.infer<InstanceType<typeof MockApiServer>['getEndpointSchema']>;
export type DeleteEndpointInput = z.infer<InstanceType<typeof MockApiServer>['deleteEndpointSchema']>;

// Note: If McpServer.tool() expects a specific return type for its handler function
// (beyond just the content part), McpToolResponseContent might need to be expanded
// or a more general McpToolFullResponse type defined.
// For now, handlers in MockApiServer return an object matching McpToolResponseContent.
