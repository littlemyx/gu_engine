import common from '../common.module.css';

export const DescriptionTextarea = ({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => (
  <textarea
    className={`nodrag nopan nowheel ${common.descriptionInput}`}
    placeholder={placeholder}
    value={value}
    onChange={e => onChange(e.target.value)}
  />
);
