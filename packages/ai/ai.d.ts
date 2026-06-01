declare module "ai" {
  export function tool(config: any): any;
  export function generateText(params: any): Promise<any>;
}
