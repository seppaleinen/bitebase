export { getModel, createLocalAI } from "./client";
export * from "./schemas/index";
export * from "./prompts/index";
export * from "./tools/index";
export { parseLessonResponse } from "./lib/parse-lesson";
export * from "./lib/parse-lesson";
export { extractProfileValues, extractTopic } from "./lib/extract-profile";
export type { ChatMessage, ExtractedProfile } from "./lib/extract-profile";
export { buildNarrativeThreads } from "./lib/narrative-thread";
export { injectImagesIntoContent, injectImagesIntoLesson } from "./lib/inject-images";
export type { LessonImage } from "./lib/inject-images";

