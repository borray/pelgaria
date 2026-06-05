using System.Collections.Generic;

namespace ExamApp.Models
{
    public class Topic
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }

        public ICollection<Question> Questions { get; set; } = new List<Question>();
    }
}
