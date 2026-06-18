export function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        const value = params[key];
        return value != null ? String(value) : `{{${key}}}`;
    });
}
