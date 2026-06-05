namespace ExamApp.Models
{
    /// <summary>Картинка, прикреплённая к вопросу. Хранится прямо в базе (BLOB).</summary>
    public class QuestionImage
    {
        public int Id { get; set; }
        public int QuestionId { get; set; }
        public byte[] ImageData { get; set; } = System.Array.Empty<byte>();
        public string? Caption { get; set; }
        public int Order { get; set; }

        public Question? Question { get; set; }
    }
}
