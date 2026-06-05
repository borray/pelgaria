namespace ExamApp.Models
{
    public class AnswerOption
    {
        public int Id { get; set; }
        public int QuestionId { get; set; }
        public string Text { get; set; } = string.Empty;
        /// <summary>Необязательная формула варианта ответа (LaTeX).</summary>
        public string? Formula { get; set; }
        /// <summary>Необязательная картинка варианта ответа (BLOB).</summary>
        public byte[]? ImageData { get; set; }
        public bool IsCorrect { get; set; }
        public int Order { get; set; }

        public Question? Question { get; set; }
    }
}
