namespace ExamApp.Models
{
    public class ParticipantAnswer
    {
        public int Id { get; set; }
        public int ParticipantResultId { get; set; }
        public int QuestionId { get; set; }

        /// <summary>
        /// For SingleChoice/MultipleChoice: JSON array of selected AnswerOption IDs.
        /// For FreeForm: null (score is entered directly).
        /// </summary>
        public string? SelectedOptionIdsJson { get; set; }

        /// <summary>
        /// For FreeForm questions: manually assigned score.
        /// For choice questions: auto-calculated.
        /// </summary>
        public int Score { get; set; }

        public ParticipantResult? ParticipantResult { get; set; }
        public Question? Question { get; set; }
    }
}
