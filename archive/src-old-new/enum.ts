/**
 * Alignment of the player or role
 */
export enum Side {
    /**
     * Not aligned with either team, NULL
     */
    NONE,
    /**
     * Aligned with the village, the "good guys"
     */
    VILLAGE,
    /**
     * Aligned with the mafia, the "bad guys"
     */
    MAFIA,
    /**
     * Separate intentions from either side with different
     * win conditions.
     */
    THIRD
}