
/* This interface describes the structure of a Movie object used in the web application
   Each property represents a piece of information about a movie. */
export interface Movie {
    /**
     * Unique identifier for the movie (used to distinguish each movie)
     */
    id: string,
    /**
     * The title or name of the movie
     */
    title: string,
    /**
     * U.R.L to the movie poster image
     */
    image: string,
    /**
     * A short summary or description of the movie's story
     */
    synopsis: string,
    /**
     * The genre or category of the movie (e.g Action and Comedy)
     */
    genre: string,
    /**
     * The movie's rating (e.g PG, R etc)
     */
    rating: string,
    /**
     * The length of the movie in minutes
     */
    runtime: number,
    /**
     * The date when the movie was released
     */
    releaseDate: string,
    /**
     * The name of the person who added the movie to the system
     */
    createdBy: string,
    /**
     * The average score given by critics (optional)
     */
    averageCriticScore?: number,
}