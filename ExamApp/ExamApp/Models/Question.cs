using System.Collections.Generic;

namespace ExamApp.Models
{
    public enum QuestionType
    {
        SingleChoice,
        MultipleChoice,
        FreeForm
    }

    public class Question
    {
        public int Id { get; set; }
        public string Text { get; set; } = string.Empty;
        public QuestionType Type { get; set; }
        public int MaxScore { get; set; } = 1;
        public int TopicId { get; set; }

        public Topic? Topic { get; set; }
        public ICollection<AnswerOption> AnswerOptions { get; set; } = new List<AnswerOption>();
        public ICollection<ExamQuestion> ExamQuestions { get; set; } = new List<ExamQuestion>();
    }
}
