export interface Review {
  id: string
  movieId: string
  criticName: string
  score: number
  comment: string
  isPublished: boolean
  publishedAt?: string
}
