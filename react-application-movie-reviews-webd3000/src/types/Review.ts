// Defines one critic review record used in the movie details page
export interface Review {
  id: string,
  movieId: string,
  title?: string,
  criticName: string,
  criticAvatarUrl?: string,
  score?: number,
  comment: string,
  isPublished: boolean,
  publishedAt?: string,
  timePublishedAgo?: string,
}
