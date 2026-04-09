
/* This interface describes the structure of a Review object used in the web application.
   Each property represents a piece of information about a critic's review for a movie. */
export interface Review {
  /**
   * Unique identifier for the review
   */
  id: string,
  /**
   * The ID of the movie this review is for
   */
  movieId: string,
  /**
   * The title or headline of the review (optional)
   */
  title?: string,
  /**
   * The name of the critic who wrote the review
   */
  criticName: string,
  /**
   * U.R.L to the critic's profile image (optional)
   */
  criticAvatarUrl?: string,
  /**
   * The score or rating given by the critic (optional)
   */
  score?: number,
  /**
   * The main text or comment of the review
   */
  comment: string,
  /**
   * Whether the review is published and visible to users
   */
  isPublished: boolean,
  /**
   * The date and time when the review was published (optional)
   */
  publishedAt?: string,
  /**
   * How long ago the review was published (in human-readable form) (optional)
   */
  timePublishedAgo?: string,
}
