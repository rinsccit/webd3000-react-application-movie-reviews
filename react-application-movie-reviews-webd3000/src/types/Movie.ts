// Defines one movie record exactly as the frontend expects to consume it
export interface Movie {
    id: string,
    title: string,
    image: string,
    synopsis: string,
    genre?: string,
    runtime: number,
    releaseDate: string,
    createdBy: string,
    averageCriticScore?: number,
}