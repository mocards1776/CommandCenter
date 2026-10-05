export type FrontStory = { id: string; headline: string; teamName: string | null };
export function frontStories(stories: unknown[], edition: string): FrontStory[];
